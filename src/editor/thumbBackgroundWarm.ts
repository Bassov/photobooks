import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import {
  getEffectiveDecodeSlotLimit,
  hasDeferredLazyDecode,
  hasPendingThumbDecode,
  processAsset,
  promoteDeferredLazyToWarm,
  type AssetProcessResult,
} from '../photo/assetPool'
import { DECODE_POOL_CAP_IDLE } from '../photo/decodeQueuePolicy'
import { scheduleWhenNowEmpty } from '../photo/decodeScheduler'
import {
  getAssetCacheKey,
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  getPlacedAssetIdsSnapshot,
  subscribeGallery,
} from './bookStore'
import { isEditorGestureActive } from './editorGesture'
import { isFilmstripScrollQuiet } from './filmstripScrollQuiet'
import {
  getFilmstripWindow,
  subscribeFilmstripWindow,
  type FilmstripWindow,
} from './filmstripWindow'
import { restoreAspectFromDecode } from './previewAspect'
import { setThumbUrl } from './thumbCache'
import { sourceFileFor } from './thumbMissDecode'

/** Main-thread budget of one warm slice; the pass yields once it is spent. */
export const WARM_SLICE_BUDGET_MS = 3

/** [book-used, distance, side, position]: lower warms first, never ties. */
type WarmRank = readonly [number, number, number, number]

function warmRank(
  id: string,
  inputIndex: number,
  window: FilmstripWindow,
  indexById: ReadonlyMap<string, number>,
  bookUsed: ReadonlySet<string>,
): WarmRank {
  const used = bookUsed.has(id) ? 0 : 1
  const index = indexById.get(id)
  const behindFirst = window.direction < 0
  if (index === undefined) {
    return [used, Number.MAX_SAFE_INTEGER, 0, inputIndex]
  }
  if (index < window.start) {
    return [used, window.start - index, behindFirst ? 0 : 1, index]
  }
  if (index >= window.end) {
    return [used, index - window.end + 1, behindFirst ? 1 : 0, index]
  }
  return [used, 0, 0, index]
}

function compareWarmRank(a: WarmRank, b: WarmRank): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]
}

function windowIndex(window: FilmstripWindow): Map<string, number> {
  const indexById = new Map<string, number>()
  window.order.forEach((id, index) => {
    indexById.set(id, index)
  })
  return indexById
}

/**
 * Warm order: book-used first, then distance from the filmstrip window; at
 * equal distance the side ahead of the last scroll direction goes first.
 * Ids missing from the window order (appended since) follow, in input order.
 */
export function orderWarmCandidates(
  ids: readonly string[],
  window: FilmstripWindow,
  bookUsed: ReadonlySet<string>,
): string[] {
  const indexById = windowIndex(window)
  return ids
    .map((id, inputIndex) => ({
      id,
      rank: warmRank(id, inputIndex, window, indexById, bookUsed),
    }))
    .sort((a, b) => compareWarmRank(a.rank, b.rank))
    .map((entry) => entry.id)
}

/** In-flight warm jobs: 1 while the strip scrolls or the canvas is gestured. */
export function warmSlotCap(): number {
  if (isFilmstripScrollQuiet() || isEditorGestureActive()) {
    return 1
  }
  return Math.min(DECODE_POOL_CAP_IDLE, getEffectiveDecodeSlotLimit())
}

/**
 * One warm pass, resumable across slices: index the window order, scan the
 * gallery into the best `want` picks, then start them. Snapshots are taken
 * at pass start.
 */
interface WarmPass {
  ids: readonly string[]
  window: FilmstripWindow
  bookUsed: ReadonlySet<string>
  indexById: Map<string, number>
  indexed: number
  scanned: number
  candidates: number
  want: number
  /** Best candidates so far, ascending rank. */
  picks: { id: string; rank: WarmRank }[]
  started: number
}

let installed = false
let passScheduled = false
let pass: WarmPass | null = null
let rerunRequested = false
const inFlight = new Set<string>()
/** `assetId\ncacheKey` that has a stored thumb or failed (never retried). */
const settled = new Set<string>()
let encodedCount = 0
let longestSliceMs = 0

function settledKey(assetId: string, cacheKey: string): string {
  return `${assetId}\n${cacheKey}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function requestWarmPass(): void {
  if (!installed) {
    return
  }
  if (pass !== null) {
    rerunRequested = true
    return
  }
  scheduleWarmSlice()
}

function scheduleWarmSlice(): void {
  if (passScheduled) {
    return
  }
  passScheduled = true
  scheduleWhenNowEmpty(runWarmSlice)
}

/** Settles `true` once the thumb exists or failed for good; `false` to retry. */
async function encodeWarmThumb(
  assetId: string,
  cacheKey: string,
): Promise<boolean> {
  try {
    // The import owner publishes + stores a promoted result.
    const promoted = promoteDeferredLazyToWarm(assetId)
    const result = await (promoted ?? runOwnJob(assetId, cacheKey))
    if (result === 'stored') {
      return true
    }
    if (result === 'taken') {
      return false
    }
    if (promoted === undefined) {
      restoreAspectFromDecode(
        assetId,
        result.correctedWidth,
        result.correctedHeight,
      )
      setThumbUrl(
        assetId,
        result.previewBuffer,
        result.previewMimeType,
        cacheKey,
      )
    }
    encodedCount += 1
    return true
  } catch (error) {
    // Unsupported HEIC / corrupt file: no retry loop. Abort: a later pass.
    return !isAbortError(error)
  }
}

/**
 * `stored`: nothing left to encode (cached already, or no source file).
 * `taken`: a now-lane decode owns it meanwhile (it publishes + stores).
 */
async function runOwnJob(
  assetId: string,
  cacheKey: string,
): Promise<AssetProcessResult | 'stored' | 'taken'> {
  const cache = await getDerivedCache()
  if (await cache.has(cacheKey, THUMB_PRESET_ID)) {
    return 'stored'
  }
  const file = await sourceFileFor(assetId)
  if (file === undefined) {
    return 'stored'
  }
  if (hasPendingThumbDecode(assetId)) {
    return 'taken'
  }
  return processAsset({
    assetId,
    file,
    priority: 'background',
    backgroundWarm: true,
    noPoolRetry: true,
  })
}

function isWarmCandidate(assetId: string): boolean {
  const cacheKey = getAssetCacheKey(assetId)
  return (
    cacheKey !== undefined &&
    !settled.has(settledKey(assetId, cacheKey)) &&
    !inFlight.has(assetId) &&
    (hasDeferredLazyDecode(assetId) || !hasPendingThumbDecode(assetId))
  )
}

/** Streaming top-`want`: same picks as `orderWarmCandidates(...).slice`. */
function offerPick(current: WarmPass, assetId: string): void {
  const rank = warmRank(
    assetId,
    current.candidates,
    current.window,
    current.indexById,
    current.bookUsed,
  )
  current.candidates += 1
  const { picks } = current
  const at =
    picks.findLastIndex((pick) => compareWarmRank(pick.rank, rank) <= 0) + 1
  picks.splice(at, 0, { id: assetId, rank })
  picks.length = Math.min(picks.length, current.want)
}

function startWarmJob(assetId: string): void {
  const cacheKey = getAssetCacheKey(assetId) ?? ''
  inFlight.add(assetId)
  void encodeWarmThumb(assetId, cacheKey).then((done) => {
    if (done) {
      settled.add(settledKey(assetId, cacheKey))
    }
    inFlight.delete(assetId)
    requestWarmPass()
  })
}

/** One unit of the pass; `false` once it is done. */
function stepWarmPass(current: WarmPass): boolean {
  const { order } = current.window
  const orderId = order[current.indexed]
  if (orderId !== undefined) {
    current.indexById.set(orderId, current.indexed)
    current.indexed += 1
    return true
  }
  const assetId = current.ids[current.scanned]
  if (assetId !== undefined) {
    current.scanned += 1
    if (isWarmCandidate(assetId)) {
      offerPick(current, assetId)
    }
    return true
  }
  const pick = current.picks[current.started]
  if (pick === undefined || inFlight.size >= warmSlotCap()) {
    return false
  }
  current.started += 1
  startWarmJob(pick.id)
  return true
}

function beginWarmPass(want: number): WarmPass {
  return {
    ids: getGalleryIdsSnapshot(),
    window: getFilmstripWindow(),
    bookUsed: getPlacedAssetIdsSnapshot(),
    indexById: new Map(),
    indexed: 0,
    scanned: 0,
    candidates: 0,
    want,
    picks: [],
    started: 0,
  }
}

/** Runs the open pass for up to `WARM_SLICE_BUDGET_MS`, then yields. */
function runWarmSlice(): void {
  passScheduled = false
  // Import keeps its own batch; gallery emit on import end re-arms the lane.
  if (!installed || getBookStoreSnapshot().importRunning) {
    pass = null
    rerunRequested = false
    return
  }
  const sliceStart = performance.now()
  if (pass === null) {
    const want = warmSlotCap() - inFlight.size
    if (want <= 0) {
      return
    }
    pass = beginWarmPass(want)
  }
  const current = pass
  let more: boolean
  let now: number
  do {
    more = stepWarmPass(current)
    now = performance.now()
  } while (more && now - sliceStart < WARM_SLICE_BUDGET_MS)
  longestSliceMs = Math.max(longestSliceMs, now - sliceStart)
  if (more) {
    scheduleWarmSlice()
    return
  }
  pass = null
  if (rerunRequested) {
    rerunRequested = false
    scheduleWarmSlice()
  }
}

/**
 * Background thumb warm lane: in idle time, encode thumb320 into DerivedCache
 * for every identity-complete gallery asset that has none yet.
 */
export function installThumbBackgroundWarm(): () => void {
  installed = true
  const offGallery = subscribeGallery(requestWarmPass)
  const offWindow = subscribeFilmstripWindow(requestWarmPass)
  requestWarmPass()
  return () => {
    installed = false
    offGallery()
    offWindow()
  }
}

export interface BackgroundWarmStats {
  encoded: number
  inFlight: number
  /** `assetId + cacheKey` entries the lane is done with (stored or failed). */
  settledCount: number
  /** Longest main-thread slice of a warm pass so far. */
  longestSliceMs: number
}

/** e2e / unit seam: warm-lane progress. */
export function getBackgroundWarmStatsForTests(): BackgroundWarmStats {
  return {
    encoded: encodedCount,
    inFlight: inFlight.size,
    settledCount: settled.size,
    longestSliceMs,
  }
}

export function resetThumbBackgroundWarmForTests(): void {
  installed = false
  passScheduled = false
  pass = null
  rerunRequested = false
  longestSliceMs = 0
  inFlight.clear()
  settled.clear()
  encodedCount = 0
}

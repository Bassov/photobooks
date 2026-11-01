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
  const indexById = new Map<string, number>()
  window.order.forEach((id, index) => {
    indexById.set(id, index)
  })
  const behindFirst = window.direction < 0
  const rank = (id: string, inputIndex: number): [number, number, number] => {
    const index = indexById.get(id)
    if (index === undefined) {
      return [Number.MAX_SAFE_INTEGER, 0, inputIndex]
    }
    if (index < window.start) {
      return [window.start - index, behindFirst ? 0 : 1, index]
    }
    if (index >= window.end) {
      return [index - window.end + 1, behindFirst ? 1 : 0, index]
    }
    return [0, 0, index]
  }
  return ids
    .map((id, inputIndex) => ({
      id,
      used: bookUsed.has(id) ? 0 : 1,
      rank: rank(id, inputIndex),
    }))
    .sort(
      (a, b) =>
        a.used - b.used ||
        a.rank[0] - b.rank[0] ||
        a.rank[1] - b.rank[1] ||
        a.rank[2] - b.rank[2],
    )
    .map((entry) => entry.id)
}

/** In-flight warm jobs: 1 while the strip scrolls or the canvas is gestured. */
export function warmSlotCap(): number {
  if (isFilmstripScrollQuiet() || isEditorGestureActive()) {
    return 1
  }
  return Math.min(DECODE_POOL_CAP_IDLE, getEffectiveDecodeSlotLimit())
}

let installed = false
let passScheduled = false
const inFlight = new Set<string>()
/** `assetId\ncacheKey` that has a stored thumb or failed (never retried). */
const settled = new Set<string>()
let encodedCount = 0

function settledKey(assetId: string, cacheKey: string): string {
  return `${assetId}\n${cacheKey}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function requestWarmPass(): void {
  if (!installed || passScheduled) {
    return
  }
  passScheduled = true
  scheduleWhenNowEmpty(runWarmPass)
}

/** Settles `true` once the thumb exists or failed for good; `false` to retry. */
async function encodeWarmThumb(
  assetId: string,
  cacheKey: string,
): Promise<boolean> {
  const promoted = promoteDeferredLazyToWarm(assetId)
  // The import owner publishes + stores a promoted result.
  const job = promoted ?? (await startOwnJob(assetId, cacheKey))
  if (job === 'stored') {
    return true
  }
  if (job === 'taken') {
    return false
  }
  try {
    const result = await job
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
async function startOwnJob(
  assetId: string,
  cacheKey: string,
): Promise<Promise<AssetProcessResult> | 'stored' | 'taken'> {
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

function runWarmPass(): void {
  passScheduled = false
  // Import keeps its own batch; gallery emit on import end re-arms the lane.
  if (!installed || getBookStoreSnapshot().importRunning) {
    return
  }
  const cap = warmSlotCap()
  if (inFlight.size >= cap) {
    return
  }
  const candidates: string[] = []
  for (const assetId of getGalleryIdsSnapshot()) {
    const cacheKey = getAssetCacheKey(assetId)
    if (
      cacheKey !== undefined &&
      !settled.has(settledKey(assetId, cacheKey)) &&
      !inFlight.has(assetId) &&
      (hasDeferredLazyDecode(assetId) || !hasPendingThumbDecode(assetId))
    ) {
      candidates.push(assetId)
    }
  }
  const ordered = orderWarmCandidates(
    candidates,
    getFilmstripWindow(),
    getPlacedAssetIdsSnapshot(),
  )
  for (const assetId of ordered.slice(0, cap - inFlight.size)) {
    const cacheKey = getAssetCacheKey(assetId) ?? ''
    inFlight.add(assetId)
    void encodeWarmThumb(assetId, cacheKey)
      .catch(() => false)
      .then((done) => {
        if (done) {
          settled.add(settledKey(assetId, cacheKey))
        }
        inFlight.delete(assetId)
        requestWarmPass()
      })
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

/** e2e / unit seam: warm-lane progress. */
export function getBackgroundWarmStatsForTests(): {
  encoded: number
  inFlight: number
} {
  return { encoded: encodedCount, inFlight: inFlight.size }
}

export function resetThumbBackgroundWarmForTests(): void {
  installed = false
  passScheduled = false
  inFlight.clear()
  settled.clear()
  encodedCount = 0
}

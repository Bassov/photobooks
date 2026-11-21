/*
 * Frame copy / paste / duplicate (Designer frame-copy-paste D3–D8). Pure
 * data: the editor owns keys, clipboard events and the step memory. The kit
 * twin is `uikit/src/sandbox/clipboard.ts`.
 */
import { z } from 'zod'
import { getSinglePageSide, getSpreadSizeMm } from '../geometry/spreadSize'
import { frameSchema, type Book, type Frame } from '../schema'
import { resolveTextContent } from '../text/resolveText'
import { findBookFrame, spreadFrames, updateSpread } from '../update'
import { detached, nextFrameId } from './frames'
import { withoutPlacement } from './place'

type Rect = Frame['rect']

/** The clipboard type of a frames payload (D1). */
export const FRAMES_PAYLOAD_TYPE = 'application/x-photobooks-frames+json'
/** D3: the paste step (mm) and how many times it repeats while taken. */
export const PASTE_STEP_MM = 5
export const PASTE_STEPS = 20
/** D3: two rects within this (mm) on every edge are the same spot. */
const TAKEN_EPS_MM = 0.01

/** What a book needs to find a copied photo again (D7). */
export interface PayloadAsset {
  contentHash?: string
  sourceRootId?: string
  relativePath?: string
}

/** Copied frames (Designer spec "Payload", version 1). */
export interface FramesPayload {
  v: 1
  bookId: string
  spreadId: string
  /** The source's single page side, else null (two pages). */
  side: 'left' | 'right' | null
  trim: { widthMm: number; heightMm: number }
  /** In z order; rects in source spread mm. */
  frames: Frame[]
  /** D6: the text each anchored caption showed at copy time. */
  texts: Record<string, string>
  assets: Record<string, PayloadAsset>
}

export interface PasteOptions {
  /** Ctrl+Shift+V: no offset and no D3 steps (D4 clamp only). */
  inPlace: boolean
  /** D8: the duplicate offset (mm); ignored in place. */
  offset?: { x: number; y: number }
}

/** D8: what the editor remembers of the last duplicate. */
export interface LastDuplicate {
  spreadId: string
  sourceRects: readonly Rect[]
  newIds: readonly string[]
}

/** Built on first use (zod schemas are not built at module load). */
function makePayloadSchema() {
  const optionalId = z.string().min(1).optional()
  return z.object({
    v: z.literal(1),
    bookId: z.string(),
    spreadId: z.string(),
    side: z.enum(['left', 'right']).nullable(),
    trim: z.object({
      widthMm: z.number().positive(),
      heightMm: z.number().positive(),
    }),
    frames: z.array(frameSchema),
    texts: z.record(z.string(), z.string()),
    assets: z.record(
      z.string(),
      z.object({
        contentHash: optionalId,
        sourceRootId: optionalId,
        relativePath: optionalId,
      }),
    ),
  })
}

let payloadSchema: ReturnType<typeof makePayloadSchema> | undefined

/**
 * A clipboard string as a frames payload (D1), or null when it is not JSON
 * or not a version 1 payload: the clipboard is untrusted input.
 */
export function parseFramesPayload(json: string): FramesPayload | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  payloadSchema ??= makePayloadSchema()
  const parsed = payloadSchema.safeParse(data)
  return parsed.success ? (parsed.data as FramesPayload) : null
}

function spreadAt(book: Book, spreadId: string) {
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  return { index, spread: book.spreads[index] }
}

/** The frames `frameIds` (own or override copies) of a spread as a payload. */
export function framesPayload(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
): FramesPayload {
  const { index, spread } = spreadAt(book, spreadId)
  const payload: FramesPayload = {
    v: 1,
    bookId: book.id,
    spreadId,
    side: getSinglePageSide(index, book.spreads.length),
    trim: { ...book.settings.trim },
    frames: [],
    texts: {},
    assets: {},
  }
  if (spread === undefined) {
    return payload
  }
  const frames = spreadFrames(spread)
    .filter((frame) => frameIds.includes(frame.id))
    .sort((a, b) => a.z - b.z)
  const { texts, assets } = payload
  for (const frame of frames) {
    if (frame.anchorFrameId !== undefined) {
      texts[frame.id] = resolveTextContent(book, spread, frame).text
    }
    const assetId = frame.assetId ?? ''
    const asset = book.assets[assetId]
    if (asset !== undefined) {
      const { contentHash, sourceRootId, relativePath } = asset
      assets[assetId] = {
        ...(contentHash !== undefined && { contentHash }),
        ...(sourceRootId !== undefined && { sourceRootId }),
        ...(relativePath !== undefined && { relativePath }),
      }
    }
  }
  return { ...payload, frames }
}

/** The least shift putting [a0, a1] inside [lo, hi]; centred when larger. */
function fit(a0: number, a1: number, lo: number, hi: number): number {
  if (a1 - a0 > hi - lo) {
    return (lo + hi) / 2 - (a0 + a1) / 2
  }
  if (a0 < lo) {
    return lo - a0
  }
  return a1 > hi ? hi - a1 : 0
}

function sameRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) <= TAKEN_EPS_MM &&
    Math.abs(a.y - b.y) <= TAKEN_EPS_MM &&
    Math.abs(a.width - b.width) <= TAKEN_EPS_MM &&
    Math.abs(a.height - b.height) <= TAKEN_EPS_MM
  )
}

/**
 * Where the payload's frames land on spread `targetSpreadId` (D3 / D4 / D8).
 * The group moves as one: through the single page slots (onto the target's
 * page when its centre is in the half with no page), by `offset`, then
 * +5/+5 mm while a rect is taken (≤ 20 steps, never in place), always
 * clamped into the target pages + bleed (centred on an axis it overflows).
 * Unknown target or empty payload → [].
 */
export function pastedRects(
  book: Book,
  targetSpreadId: string,
  payload: FramesPayload,
  { inPlace, offset = { x: 0, y: 0 } }: PasteOptions,
): Rect[] {
  const { index, spread } = spreadAt(book, targetSpreadId)
  const rects = payload.frames.map((frame) => frame.rect)
  if (spread === undefined || rects.length === 0) {
    return []
  }
  const pageW = book.settings.trim.widthMm
  const bleed = book.settings.bleedMm
  const { widthMm, heightMm } = getSpreadSizeMm(book, index)
  const side = getSinglePageSide(index, book.spreads.length)
  const x0 = Math.min(...rects.map((r) => r.x))
  const x1 = Math.max(...rects.map((r) => r.x + r.width))
  const y0 = Math.min(...rects.map((r) => r.y))
  const y1 = Math.max(...rects.map((r) => r.y + r.height))
  const fromSlot = payload.side === 'right' ? payload.trim.widthMm : 0
  const centre = (x0 + x1) / 2 + fromSlot
  const ontoPage =
    side === 'right' && centre < pageW
      ? pageW
      : side === 'left' && centre > pageW
        ? -pageW
        : 0
  const toSlot = side === 'right' ? pageW : 0
  const baseX = fromSlot + ontoPage - toSlot + (inPlace ? 0 : offset.x)
  const baseY = inPlace ? 0 : offset.y
  const at = (step: number): Rect[] => {
    const sx = baseX + step * PASTE_STEP_MM
    const sy = baseY + step * PASTE_STEP_MM
    const dx = sx + fit(x0 + sx, x1 + sx, -bleed, widthMm + bleed)
    const dy = sy + fit(y0 + sy, y1 + sy, -bleed, heightMm + bleed)
    return rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }))
  }
  const others = spreadFrames(spread).map((frame) => frame.rect)
  const taken = (out: readonly Rect[]) =>
    out.some((r) => others.some((other) => sameRect(r, other)))
  let out = at(0)
  for (let step = 1; !inPlace && step <= PASTE_STEPS && taken(out); step++) {
    out = at(step)
  }
  return out
}

/**
 * D8 offset for duplicating `frameIds`: run on the copies the last duplicate
 * made (same spread, same set), it is where the user moved them from their
 * source (first frame, z order); else, or when they did not move, +5/+5 mm.
 */
export function stepRepeatOffset(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  last: LastDuplicate | null,
): { x: number; y: number } {
  const step = { x: PASTE_STEP_MM, y: PASTE_STEP_MM }
  if (
    last?.spreadId !== spreadId ||
    last.newIds.length !== frameIds.length ||
    !last.newIds.every((id) => frameIds.includes(id))
  ) {
    return step
  }
  const [source] = last.sourceRects
  const now = findBookFrame(book, spreadId, last.newIds[0] ?? '')
  if (now === undefined || source === undefined) {
    return step
  }
  const x = now.rect.x - source.x
  const y = now.rect.y - source.y
  return x === 0 && y === 0 ? step : { x, y }
}

/** The ids a paste of `count` frames onto the spread gets (`nextFrameId` in order). */
export function nextFrameIds(
  book: Book,
  spreadId: string,
  count: number,
): string[] {
  const { spread } = spreadAt(book, spreadId)
  if (spread === undefined) {
    return []
  }
  const frames = [...spreadFrames(spread)]
  const ids: string[] = []
  while (ids.length < count) {
    const id = nextFrameId({ ...spread, frames })
    ids.push(id)
    frames.push({ id, rect: { x: 0, y: 0, width: 1, height: 1 }, z: 0 })
  }
  return ids
}

/** D7: the target book's asset for a copied photo, else undefined. */
function matchedAsset(
  book: Book,
  payload: FramesPayload,
  copiedId: string | undefined,
): string | undefined {
  const assetId = copiedId ?? ''
  if (payload.bookId === book.id && book.assets[assetId] !== undefined) {
    return assetId
  }
  const wanted = payload.assets[assetId]
  if (wanted === undefined) {
    return undefined
  }
  const entries = Object.entries(book.assets)
  const byHash =
    wanted.contentHash === undefined
      ? undefined
      : entries.find(([, asset]) => asset.contentHash === wanted.contentHash)
  const byPath =
    wanted.sourceRootId === undefined || wanted.relativePath === undefined
      ? undefined
      : entries.find(
          ([, asset]) =>
            asset.sourceRootId === wanted.sourceRootId &&
            asset.relativePath === wanted.relativePath,
        )
  return (byHash ?? byPath)?.[0]
}

/** D7 status: how many of the payload's photo frames paste empty into `book`. */
export function unmatchedPhotoCount(
  book: Book,
  payload: FramesPayload,
): number {
  return payload.frames.filter(
    (frame) =>
      frame.assetId !== undefined &&
      matchedAsset(book, payload, frame.assetId) === undefined,
  ).length
}

/**
 * Paste the payload onto spread `spreadId` at `pastedRects` (D5–D7): own,
 * unlocked copies on top in z order with `ids` (else `nextFrameIds`); the
 * spread leaves its template. A caption keeps a copied anchor (remapped) or
 * one still standing on its source spread, else turns static with its copied
 * text. Photos the book lacks and unknown frame styles are dropped. Bad
 * `ids` (count, duplicates, taken), an unknown spread or an empty payload →
 * the same book.
 */
export function pasteFrames(
  book: Book,
  spreadId: string,
  payload: FramesPayload,
  options: PasteOptions,
  ids?: readonly string[],
): Book {
  const { spread } = spreadAt(book, spreadId)
  const count = payload.frames.length
  if (spread === undefined || count === 0) {
    return book
  }
  const shown = spreadFrames(spread)
  const newIds = ids ?? nextFrameIds(book, spreadId, count)
  if (
    newIds.length !== count ||
    new Set(newIds).size !== count ||
    shown.some((frame) => newIds.includes(frame.id))
  ) {
    return book
  }
  const rects = pastedRects(book, spreadId, payload, options)
  const idOf = new Map(payload.frames.map((frame, i) => [frame.id, i]))
  const top = shown.reduce((max, frame) => Math.max(max, frame.z), 0)
  const anchorStays = (anchorId: string) =>
    payload.bookId === book.id &&
    payload.spreadId === spreadId &&
    spread.frames.some((f) => f.id === anchorId && f.kind !== 'text')
  const copies = payload.frames.map((frame, i): Frame => {
    const copy: Frame & { overridesId?: string } = {
      ...frame,
      id: newIds[i] ?? frame.id,
      rect: rects[i] ?? frame.rect,
      z: top + 1 + i,
    }
    delete copy.locked
    delete copy.overridesId
    if (book.frameStyles[copy.frameStyleId ?? ''] === undefined) {
      delete copy.frameStyleId
    }
    const assetId = matchedAsset(book, payload, frame.assetId)
    const placed =
      assetId === undefined ? withoutPlacement(copy) : { ...copy, assetId }
    const anchorId = frame.anchorFrameId
    if (anchorId === undefined) {
      return placed
    }
    const remapped = idOf.get(anchorId)
    if (remapped !== undefined) {
      return { ...placed, anchorFrameId: newIds[remapped] }
    }
    if (anchorStays(anchorId)) {
      return placed
    }
    const text = payload.texts[frame.id] ?? ''
    const frozen: Frame = { ...placed, content: { type: 'static', text } }
    delete frozen.anchorFrameId
    return frozen
  })
  return updateSpread(book, spreadId, (current) =>
    detached(current, [...current.frames, ...copies]),
  )
}

/**
 * Duplicate `frameIds` on their spread (D8): a paste of their own payload
 * at +dx / +dy with the D3 steps.
 */
export function duplicateFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  dx: number,
  dy: number,
  ids?: readonly string[],
): Book {
  const payload = framesPayload(book, spreadId, frameIds)
  return pasteFrames(
    book,
    spreadId,
    payload,
    { inPlace: false, offset: { x: dx, y: dy } },
    ids,
  )
}

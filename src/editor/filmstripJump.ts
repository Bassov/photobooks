import { setSelectedAssetId } from './gallerySelection'
import { indexFromScrollOffset } from './thumbSlotSize'

type Listener = () => void

const listeners = new Set<Listener>()

export interface FilmstripJumpRequest {
  assetId: string
  seq: number
}

let jumpRequest: FilmstripJumpRequest | null = null
let highlightAssetId: string | null = null
let highlightTimer: ReturnType<typeof setTimeout> | undefined
let jumpSeq = 0

export const FILMSTRIP_JUMP_HIGHLIGHT_MS = 1200

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeFilmstripJump(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getFilmstripJumpRequest(): FilmstripJumpRequest | null {
  return jumpRequest
}

export function getFilmstripJumpHighlightId(): string | null {
  return highlightAssetId
}

/** Pure scroll math for jump-to-tile (unit-tested; Filmstrip applies the write). */
export function filmstripJumpScrollPlan(
  gallery: readonly string[],
  prefix: readonly number[],
  assetId: string,
): { scrollLeft: number; windowStart: number } | null {
  const index = gallery.indexOf(assetId)
  if (index === -1) {
    return null
  }
  const scrollLeft = prefix[index] ?? 0
  return {
    scrollLeft,
    windowStart: indexFromScrollOffset(scrollLeft, prefix),
  }
}

/** Applies a jump plan to a scroll node; returns windowStart or null. */
export function applyFilmstripJumpScroll(
  node: HTMLElement | null,
  plan: { scrollLeft: number; windowStart: number } | null,
): number | null {
  if (node === null || plan === null) {
    return null
  }
  node.scrollLeft = plan.scrollLeft
  return plan.windowStart
}

export function requestFilmstripJump(assetId: string): void {
  jumpSeq += 1
  jumpRequest = { assetId, seq: jumpSeq }
  setSelectedAssetId(assetId)
  highlightAssetId = assetId
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightTimer = undefined
    highlightAssetId = null
    emit()
  }, FILMSTRIP_JUMP_HIGHLIGHT_MS)
  emit()
}

export function resetFilmstripJumpForTests(): void {
  clearTimeout(highlightTimer)
  highlightTimer = undefined
  jumpRequest = null
  highlightAssetId = null
  jumpSeq = 0
  emit()
}

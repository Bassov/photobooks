/*
 * The room's layout picks (Designer D40): its mode for a box, the portrait
 * page geometry, and what a slide is and which keys step it.
 */
import { spreadRatio, type RoomSlide } from '../siteModel'
import type { RoomBook } from '../SiteSlide'

type RoomMode = 'port' | 'land' | 'desk'
export const roomMode = (w: number, h: number): RoomMode =>
  w < 768 && h > w ? 'port' : w > h && h < 500 ? 'land' : 'desk'

/**
 * Page size and rows for a w × h portrait screen: header 44 + 8 + page + 8 +
 * label 24, centred in [8, h − 64].
 */
export function portGeo(rb: RoomBook, w: number, h: number) {
  const rp = spreadRatio(rb.book.settings.trim) / 2
  const pw = Math.min(w - 32, (h - 172) * rp)
  const ph = pw / rp
  const gt = Math.max(8, 8 + (h - 72 - (ph + 84)) / 2)
  return { pw, ph, gt, stageTop: gt + 52, footTop: gt + 52 + ph + 8 }
}

/** The kind of a slide (tests read it as `data-kind`). */
export const slideKind = (s: RoomSlide): 'cover' | 'spread' | 'page' =>
  s.page === undefined ? 'cover' : s.page.side === 'both' ? 'spread' : 'page'

const KEY_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
}

/** Slide steps for a key event, or null when the event is not ours. */
export function slideKey(e: KeyboardEvent): number | 'home' | 'end' | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  const t = e.target as Partial<Element> | null
  if (t?.closest?.('input,textarea,select,[contenteditable]')) return null
  if (e.key === 'Home') return 'home'
  if (e.key === 'End') return 'end'
  return KEY_STEP[e.key] ?? null
}

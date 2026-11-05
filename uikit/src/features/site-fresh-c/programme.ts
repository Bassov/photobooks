/* Site fresh C: the programme. Every book owns one minute of the clock in turn (book i at minutes ≡ i mod N) and its
   views share that minute evenly, so the position depends on the time of day only. */
import { viewsOf, type SiteBook } from "../site-demo-1/data"

export const SLOT_MS = 60_000

export type At = { i: number; view: number; n: number; slot: number; elapsed: number; nextAt: number }

/** where the programme is at `now` (ms since epoch) */
export function at(books: SiteBook[], now: number): At {
  const slot = Math.floor(now / SLOT_MS)
  const i = slot % books.length
  const n = viewsOf(books[i])
  const elapsed = now - slot * SLOT_MS
  const dwell = SLOT_MS / n
  const view = Math.min(n - 1, Math.floor(elapsed / dwell))
  return { i, view, n, slot, elapsed, nextAt: slot * SLOT_MS + Math.min(SLOT_MS, (view + 1) * dwell) }
}

/** the start (ms) of book j's current or next minute */
export function startOf(books: SiteBook[], j: number, now: number) {
  const { i, slot } = at(books, now)
  return (slot + ((j - i + books.length) % books.length)) * SLOT_MS
}

export const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** `?books=1|3|6|12` → that many books (12 = the six + EXTRA) */
export function pick<T>(all: T[], n: number) {
  return all.slice(0, Math.max(1, Math.min(all.length, n)))
}

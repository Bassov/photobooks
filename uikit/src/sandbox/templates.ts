/* Template catalogue with slot aspect classes + pure best-fit by count and orientation (template-slot-aspects). */
import { templates as BASE, P, type Template } from "@/data"
const SW = 400, SH = 200
export function aspectClass(w: number, h: number): "portrait" | "landscape" | "square" {
  const r = w / h
  return r > 1.15 ? "landscape" : r < 0.87 ? "portrait" : "square"
}

export const EXTRA: Template[] = [
  { id: "t-2port", name: "Two portraits", count: 2, group: "2", frames: [{ x: 8, y: 8, w: 34, h: 84 }, { x: 58, y: 8, w: 34, h: 84 }] },
  { id: "t-land2port", name: "Landscape + 2 portraits", count: 3, group: "3", frames: [{ x: 4, y: 14, w: 42, h: 56 }, { x: 54, y: 8, w: 20, h: 84 }, { x: 76, y: 8, w: 20, h: 84 }] },
]
export const ALL_TEMPLATES: Template[] = [...BASE, ...EXTRA]
export const TT = (id: string) => ALL_TEMPLATES.find((t) => t.id === id) ?? contactSheet(id)
export const slotClasses = (t: Template) => t.frames.map((b) => aspectClass(b.w * SW / 100, b.h * SH / 100))

export function contactSheet(id: string): Template {
  const m = /^t-cs-(\d)x(\d)$/.exec(id)
  const c = m ? Number(m[1]) : 3, r = m ? Number(m[2]) : 2
  const frames = []
  for (const page of [0, 1]) {
    const x0 = page * 50 + 4, w = 42, y0 = 8, h = 84, g = 1.5
    const cw = (w - g * (c - 1)) / c, rh = (h - g * 2 * (r - 1)) / r
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) frames.push({ x: x0 + i * (cw + g), y: y0 + j * (rh + g * 2), w: cw, h: rh })
  }
  return { id: `t-cs-${c}x${r}`, name: `Contact sheet ${c}×${r}`, count: frames.length, group: "4", frames }
}
/** pure best-fit: same count first, then the number of slots whose aspect class matches the photos in order */
export function bestTemplate(photoIds: string[], pool: Template[] = ALL_TEMPLATES) {
  const cls = photoIds.map((id) => { const p = P(id); return aspectClass(p.w, p.h) })
  let best = pool[0], score = -Infinity
  for (const t of pool) {
    const sc = slotClasses(t)
    const countPenalty = Math.abs(t.count - photoIds.length) * 10 + (t.count < photoIds.length ? 15 : 0)
    const match = sc.reduce((a, c, i) => a + (cls[i] && cls[i] === c ? 3 : cls[i] && c === "square" ? 1 : 0), 0)
    const s = match - countPenalty
    if (s > score) { score = s; best = t }
  }
  return best
}

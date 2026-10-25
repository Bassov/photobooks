import { useSyncExternalStore } from "react"
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
export const TT = (id: string) => ALL_TEMPLATES.find((t) => t.id === id) ?? custom.find((t) => t.id === id) ?? contactSheet(id)
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

/* v5: ~10 standard layouts (8 base + 2 aspect extras) plus "My templates" — the user's own layouts.
   Custom templates live in their own reactive store; TT() resolves both. */
export const BUILTIN = () => ALL_TEMPLATES
export const slotCount = (t: Template) => t.frames.length
let custom: Template[] = [
  { id: "c-opener", name: "Travel opener", count: 2, group: "2", frames: [{ x: 0, y: 0, w: 62, h: 100 }, { x: 68, y: 30, w: 28, h: 40 }] },
  { id: "c-polaroid", name: "Polaroid pair", count: 2, group: "2", frames: [{ x: 10, y: 14, w: 30, h: 60 }, { x: 60, y: 24, w: 30, h: 60 }] },
  { id: "c-quote", name: "Quote + photo", count: 1, group: "1", frames: [{ x: 52, y: 8, w: 44, h: 84 }] },
]
const csubs = new Set<() => void>()
const emit = () => csubs.forEach((f) => f())
export const getCustom = () => custom
export function useCustomTemplates() { return useSyncExternalStore((f) => { csubs.add(f); return () => { csubs.delete(f) } }, getCustom) }
export const isCustom = (id: string) => custom.some((t) => t.id === id)
let seq = 0
const newId = () => `c-${Date.now().toString(36)}-${++seq}`
export function addCustom(name: string, frames: Template["frames"]) {
  const t: Template = { id: newId(), name, count: frames.length, group: String(Math.min(4, frames.length)), frames }
  custom = [...custom, t]; emit(); return t
}
export function renameCustom(id: string, name: string) { const n = name.trim(); if (!n) return; custom = custom.map((t) => (t.id === id ? { ...t, name: n } : t)); emit() }
export function duplicateCustom(id: string) {
  const src = custom.find((t) => t.id === id); if (!src) return
  const names = new Set(custom.map((t) => t.name)); let name = `${src.name} copy`, k = 2
  while (names.has(name)) name = `${src.name} copy ${k++}`
  const t: Template = { ...src, id: newId(), name, frames: src.frames.map((b) => ({ ...b })) }
  const i = custom.findIndex((x) => x.id === id); custom = [...custom.slice(0, i + 1), t, ...custom.slice(i + 1)]; emit(); return t
}
export function deleteCustom(id: string) { custom = custom.filter((t) => t.id !== id); emit() }
export function nextCustomName() { const names = new Set(custom.map((t) => t.name)); let n = 1; while (names.has(`My layout ${n}`)) n++; return `My layout ${n}` }

/* hover preview of a template on the current spread (layout section → canvas) */
let preview: string | null = null
const subs = new Set<() => void>()
export function setTemplatePreview(id: string | null) { if (preview !== id) { preview = id; subs.forEach((f) => f()) } }
export function useTemplatePreview() { return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => preview) }

/* Frame copy / cut / paste / duplicate on the kit frame model (Designer frame-copy-paste FC1: D3–D9).
   The keys and the document copy / cut / paste listeners live in viewport.tsx useEditorKeys; this file is pure data. */
import { PAGE, SW, SH, uid, type Doc, type Frame, type Spread } from "./model"
import { anchorPhoto, fillTokens } from "./meta"

/** The clipboard type of a frames payload (D1). */
export const FRAMES_TYPE = "application/x-photobooks-frames+json"
/** D3: the paste step (mm) and how many times it repeats while the spot is taken. */
export const PASTE_STEP = 5, PASTE_STEPS = 20
const EPS = 0.01
const DEFAULT_BLEED = 3

export type Rect = { x: number; y: number; w: number; h: number }
export type FramesPayload = {
  v: 1; spreadId: string
  /** the source's single page (spread 0 shows only its right page), else null */ side: "left" | "right" | null
  /** frames in z order, rects in source spread mm */ frames: Frame[]
  /** D6: the text each live caption showed at copy time */ texts: Record<string, string>
}

/** spread 0 holds page 1 alone, on the right (the last page is its own node, not a spread) */
const sideOf = (si: number): "left" | "right" | null => (si === 0 ? "right" : null)

export function framesPayload(d: Doc, si: number, ids: string[]): FramesPayload {
  const s = d.spreads[si]
  const frames = s.frames.filter((f) => ids.includes(f.id))
  const texts: Record<string, string> = {}
  for (const f of frames) if (f.live && f.anchor) texts[f.id] = fillTokens(f.text ?? "", anchorPhoto(s.frames, f))
  return { v: 1, spreadId: s.id, side: sideOf(si), frames, texts }
}

export function parsePayload(json: string): FramesPayload | null {
  try {
    const p = JSON.parse(json) as FramesPayload
    return p?.v === 1 && Array.isArray(p.frames) && p.frames.length ? p : null
  } catch { return null }
}

const bbox = (rs: Rect[]) => {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y))
  return { x0, y0, x1: Math.max(...rs.map((r) => r.x + r.w)), y1: Math.max(...rs.map((r) => r.y + r.h)) }
}
const shift = (rs: Rect[], dx: number, dy: number) => rs.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }))
/** the least shift that puts [a0, a1] inside [lo, hi]; centred when it is larger */
const fit = (a0: number, a1: number, lo: number, hi: number) =>
  a1 - a0 > hi - lo ? (lo + hi) / 2 - (a0 + a1) / 2 : a0 < lo ? lo - a0 : a1 > hi ? hi - a1 : 0

/** D4: the target's pages + bleed, in target spread mm */
function area(d: Doc, si: number) {
  const b = d.print?.bleed ?? DEFAULT_BLEED, side = sideOf(si)
  return { x0: (side === "right" ? PAGE : 0) - b, x1: (side === "left" ? PAGE : SW) + b, y0: -b, y1: SH + b }
}

/**
 * D3 / D4 / D8: where the payload's frames land on spread `si`. The group moves as one: onto the target's page when
 * its centre lies in a half with no page, by `offset`, then +5/+5 mm while some frame on the target has the same rect
 * (≤ 20 steps; `inPlace` never steps), always clamped into the target pages + bleed.
 */
export function pastedRects(d: Doc, si: number, p: FramesPayload, { inPlace = false, offset = { x: 0, y: 0 } }: { inPlace?: boolean; offset?: { x: number; y: number } } = {}): Rect[] {
  let rs: Rect[] = p.frames.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const side = sideOf(si), cx = (bbox(rs).x0 + bbox(rs).x1) / 2
  if (side === "right" && cx < PAGE) rs = shift(rs, PAGE, 0)
  if (side === "left" && cx > PAGE) rs = shift(rs, -PAGE, 0)
  if (!inPlace) rs = shift(rs, offset.x, offset.y)
  const a = area(d, si)
  const clamp = (r: Rect[]) => { const b = bbox(r); return shift(r, fit(b.x0, b.x1, a.x0, a.x1), fit(b.y0, b.y1, a.y0, a.y1)) }
  const others = d.spreads[si].frames
  const same = (r: Rect, f: Frame) => Math.abs(r.x - f.x) <= EPS && Math.abs(r.y - f.y) <= EPS && Math.abs(r.w - f.w) <= EPS && Math.abs(r.h - f.h) <= EPS
  const taken = (r: Rect[]) => r.some((x) => others.some((f) => same(x, f)))
  let out = clamp(rs)
  for (let k = 1; !inPlace && k <= PASTE_STEPS && taken(out); k++) out = clamp(shift(rs, PASTE_STEP * k, PASTE_STEP * k))
  return out.map((r) => ({ ...r, x: round2(r.x), y: round2(r.y) }))
}
const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * D5 / D6: the payload's frames as new own frames on top of spread `si` at `rects`, unlocked, with new ids; the spread
 * leaves its template. A live caption keeps an anchor that was copied with it (remapped) or still stands on this
 * spread; else it turns static with the text it showed at copy time. A frame style the doc lacks is dropped.
 */
export function pasteFrames(d: Doc, si: number, p: FramesPayload, rects: Rect[]): { doc: Doc; ids: string[] } {
  const ids = p.frames.map(() => uid())
  const idOf = new Map(p.frames.map((f, i) => [f.id, ids[i]]))
  const s = d.spreads[si]
  const keepsAnchor = (a: string) => s.id === p.spreadId && s.frames.some((f) => f.id === a && f.kind === "image")
  const copies = p.frames.map((f, i): Frame => {
    const c: Frame = { ...f, ...rects[i], id: ids[i], locked: undefined, overrides: undefined }
    if (c.styleId && !d.styles.some((x) => x.id === c.styleId)) c.styleId = undefined
    if (!f.anchor) return c
    const a = idOf.get(f.anchor)
    if (a) return { ...c, anchor: a }
    if (keepsAnchor(f.anchor)) return c
    return { ...c, anchor: undefined, live: false, text: p.texts[f.id] ?? f.text }
  })
  const next: Spread = { ...s, template: null, frames: [...s.frames, ...copies] }
  return { doc: { ...d, spreads: d.spreads.map((x, j) => (j === si ? next : x)) }, ids }
}

/* ---------------------------------------------------------------- memory: the last copy (menu Paste, tool 2) + D8 step */
type LastDuplicate = { spreadId: string; sourceRects: Rect[]; newIds: string[] }
let mirror: FramesPayload | null = null
let lastDuplicate: LastDuplicate | null = null
/** D1: the in-memory copy of the last frames copy (the menu Paste has no clipboard event). */
export const clipboardMirror = () => mirror
export const setClipboardMirror = (p: FramesPayload) => { mirror = p }
/** A fresh #/demo session starts with no clipboard and no step memory. */
export function resetClipboard() { mirror = null; lastDuplicate = null }

/**
 * D8 Ctrl+D: duplicate the selected frames of spread `si`. Run again on the copies it just made (same spread), the offset is
 * where the user moved them from their source (first frame, z order); else, or when they did not move, +5/+5 mm.
 */
export function duplicateFrames(d: Doc, si: number, ids: string[]): { doc: Doc; ids: string[] } {
  const s = d.spreads[si], p = framesPayload(d, si, ids)
  const rects = p.frames.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const last = lastDuplicate
  const repeat = last && last.spreadId === s.id && last.newIds.length === ids.length && last.newIds.every((id) => ids.includes(id))
  let offset = { x: PASTE_STEP, y: PASTE_STEP }
  if (repeat) {
    const now = s.frames.find((f) => f.id === last.newIds[0])!
    const o = { x: round2(now.x - last.sourceRects[0].x), y: round2(now.y - last.sourceRects[0].y) }
    if (o.x || o.y) offset = o
  }
  const out = pasteFrames(d, si, p, pastedRects(d, si, p, { offset }))
  lastDuplicate = { spreadId: s.id, sourceRects: rects, newIds: out.ids }
  return out
}

/** Ctrl+D on a spread row: the same copy as the row menu's Duplicate (chrome.tsx SpreadItemMenu), right after spread `i`. */
export function duplicateSpread(d: Doc, i: number): Doc {
  const src = d.spreads[i]
  const n = Date.now() % 1000, cid = (id: string) => `${id}c${n}`
  const copy: Spread = { ...src, id: `s${Date.now()}`, frames: src.frames.map((f) => ({ ...f, id: cid(f.id), ...(f.anchor && { anchor: cid(f.anchor) }) })) }
  return { ...d, spreads: [...d.spreads.slice(0, i + 1), copy, ...d.spreads.slice(i + 1)] }
}

/** Undo labels and statuses (Keys table). */
export const countLabel = (verb: string, n: number) => (n > 1 ? `${verb} ${n} frames` : `${verb} frame`)
export const COPIED_MS = 2000

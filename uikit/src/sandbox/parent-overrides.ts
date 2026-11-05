/* Designer parent-overrides (Spec 2026-11-04): pure helpers for the kit's parent overrides — the Ctrl/⌘+Shift hit test
   (PO2, parent-overrides-canvas review 3: copies first), the override badge fit rule (PO3) and the spread inspector's
   "Changed from {parent}" rows (PO7). A copy is an own frame / guide with `overrides`; a hidden parent item is in `hiddenParent`. */
import { parentOf, guidesOf, round, type Doc, type Frame, type Guide, type Spread } from "./model"

type Pt = { x: number; y: number }

/** Ctrl+Shift or ⌘+Shift (both on every platform). Alt is prod's snap bypass, never an override key. */
export const isOverridePress = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => e.shiftKey && (e.ctrlKey || e.metaKey)

/** Rotation-aware: the point (mm) inside the frame rotated about its centre. */
export function frameContains(f: Frame, p: Pt): boolean {
  const a = -(f.rot || 0) * Math.PI / 180, dx = p.x - (f.x + f.w / 2), dy = p.y - (f.y + f.h / 2)
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= f.w / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= f.h / 2
}

/** Parent frames the spread paints: not hidden and not replaced by a local copy. */
export function parentFramesOf(doc: Doc, s: Spread): Frame[] {
  const copied = new Set(s.frames.map((f) => f.overrides))
  return (parentOf(doc, s)?.frames ?? []).filter((f) => !(s.hiddenParent ?? []).includes(f.id) && !copied.has(f.id))
}

export type ParentHit = { kind: "guide"; guide: Guide } | { kind: "copy"; frame: Frame } | { kind: "parent"; frame: Frame } | null
/** PO2 hit test at a press `p` (mm), `sc` px per mm: a painted parent guide within 4.5 screen px, else the topmost
 *  override copy, else the topmost parent frame — through the spread's own frames. */
export function parentHit(doc: Doc, s: Spread, p: Pt, sc: number, inherited: Guide[]): ParentHit {
  const near = inherited
    .map((g) => ({ g, d: Math.abs(g.pos - (g.axis === "v" ? p.x : p.y)) * sc }))
    .filter((x) => x.d <= 4.5).sort((a, b) => a.d - b.d)[0]
  if (near) return { kind: "guide", guide: near.g }
  const copy = s.frames.filter((f) => f.overrides && frameContains(f, p)).at(-1)
  if (copy) return { kind: "copy", frame: copy }
  const par = parentFramesOf(doc, s).filter((f) => frameContains(f, p)).at(-1)
  return par ? { kind: "parent", frame: par } : null
}

/** PO3 badge fit on the frame's screen size: full ("override", 66.42 px wide) / icon-only 18 px / none. */
export const BADGE_W = 66.42, BADGE_MIN_H = 24.84
export function badgeFit(w: number, h: number): "full" | "icon" | "none" {
  if (h < BADGE_MIN_H) return "none"
  return w >= BADGE_W + 8 ? "full" : w >= 26 ? "icon" : "none"
}

/* Spread ops (one undo step each at the call site). */
export const overrideFrame = (s: Spread, f: Frame, id: string): Spread => ({ ...s, frames: [...s.frames, { ...f, id, overrides: f.id }] })
const hide = (s: Spread, ids: string[]): Spread => ids.length ? { ...s, hiddenParent: [...new Set([...(s.hiddenParent ?? []), ...ids])] } : s
/** Delete on a copy = "not on this spread": the copy goes and its parent id is hidden. */
export const hideCopies = (s: Spread, removed: Frame[]): Spread => hide(s, removed.flatMap((f) => (f.overrides ? [f.overrides] : [])))
export const hideParentGuide = (s: Spread, parentId: string): Spread => hide({ ...s, guides: s.guides.filter((g) => g.overrides !== parentId) }, [parentId])
/** ↺ on one change: the copy (frame or guide) goes and the parent id is no longer hidden. */
export function resetParentItem(s: Spread, parentId: string): Spread {
  const hp = (s.hiddenParent ?? []).filter((x) => x !== parentId)
  return { ...s, frames: s.frames.filter((f) => f.overrides !== parentId), guides: s.guides.filter((g) => g.overrides !== parentId), hiddenParent: hp.length ? hp : undefined }
}
/** Reset all: no copies, nothing hidden. */
export const resetSpreadToParent = (s: Spread): Spread =>
  ({ ...s, frames: s.frames.filter((f) => !f.overrides), guides: s.guides.filter((g) => !g.overrides), hiddenParent: undefined })

export type ParentChange = { id: string; state: "override" | "hidden"; name: string }
const frameName = (f: Frame) => f.kind === "text" ? `Text “${(f.text ?? "").slice(0, 24)}”` : f.photo ? "Photo frame" : "Empty frame"
const guideName = (g: Guide) => `Guide · ${g.axis === "v" ? "vertical" : "horizontal"} ${round(g.pos, 1)} mm`
const byGuide = (a: Guide, b: Guide) => (a.axis === b.axis ? a.pos - b.pos : a.axis === "v" ? -1 : 1)
/** PO7 rows: overridden frames, hidden frames (parent z, top first), overridden guides, hidden guides (vertical first, by
 *  position). Hidden ids whose parent item is gone are not listed; a copy whose parent item is gone still is. */
export function parentChanges(doc: Doc, s: Spread): ParentChange[] {
  const par = parentOf(doc, s), pf = par?.frames ?? [], pg = guidesOf(par), hp = s.hiddenParent ?? []
  const z = (id?: string) => pf.findIndex((f) => f.id === id)
  return [
    ...s.frames.filter((f) => f.overrides).sort((a, b) => z(b.overrides) - z(a.overrides)).map((f) => ({ id: f.overrides!, state: "override" as const, name: frameName(f) })),
    ...pf.filter((f) => hp.includes(f.id)).reverse().map((f) => ({ id: f.id, state: "hidden" as const, name: frameName(f) })),
    ...s.guides.filter((g) => g.overrides).sort(byGuide).map((g) => ({ id: g.overrides!, state: "override" as const, name: guideName(g) })),
    ...pg.filter((g) => hp.includes(g.id)).sort(byGuide).map((g) => ({ id: g.id, state: "hidden" as const, name: guideName(g) })),
  ]
}

/* Designer cycle-layouts CL2 (Owner Q-27; prod twin: src/editor/LayoutCycle.tsx + layoutCycle.ts, CL3):
   a pill centred 8 px above the active paper and ⇧[ / ⇧] step the spread through the layouts with its photo count. */
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { framesFromTemplate, type Frame, type Spread } from "./model"
import { useStudio, mapSpreadFreezing, type Studio } from "./store"
import { applyId, cycleSet, getCustom, ownPhotoFrame, pickerAlias, stepLayout, useCustomTemplates } from "./templates"
import { T, SUB } from "./v7"

/** Page labels (19) + 8 + pill (28) + 8: a stacked spread below a smaller gap shows no pill (slot 0 always has room). */
export const LAYOUT_CYCLE_MIN_GAP_PX = 19 + 8 + 28 + 8

/** D6 (core rebindFrames): frame `i` of the new layout is old frame `i` — id, photo, crop, fit, adjust, caption, style and
 *  lock kept — with the template's rect and no rotation; the template order is the z order. Extra template slots stay fresh.
 *  `ids: "fresh"` (the inspector picker) gives the new frames their own ids, so a live caption on the old frame freezes
 *  (Designer live-captions §6); the cycle keeps the ids, so the selection holds and ‹ after › gives the same frames. */
export function rebindFrames(old: Frame[], fresh: Frame[], ids: "keep" | "fresh" = "keep"): Frame[] {
  return fresh.map((f, i) => (old[i] ? { ...old[i], id: ids === "keep" ? old[i].id : f.id, x: f.x, y: f.y, w: f.w, h: f.h, rot: 0 } : f))
}

/** Spread-level conditions (Spec "Shown only when"), all but the room above and the spread-local marquee / text edit. */
export function cycleReady(st: Studio) {
  const nd = st.node
  return st.mode === "pages" && (!nd || nd.k === "book" || nd.k === "none") && !st.view.preview && !st.dragging && !st.drafting && !st.cropId
}

/** The cycle of spread `si`: its set, the current layout's index (-1 = Custom) and the name to show. */
export function cycleOf(spread: Spread, single: boolean, mine = getCustom()) {
  const set = cycleSet(spread, single, mine)
  const cur = pickerAlias(spread.template, single)
  const i = set.findIndex((t) => t.id === cur)
  return { set, i, name: i < 0 ? "Custom" : set[i].name }
}

/** ‹ (-1) / › (1): the next layout of the set on the current spread, photos and frame props kept by index; a run of presses
 *  on one spread is one "Change layout" step (store `cycle:` coalescing, D5). No status: the pill shows the name (D8). */
export function cycleLayout(st: Studio, dir: 1 | -1) {
  const si = st.cur, s = st.doc.spreads[si], single = si === 0
  const { set, i } = cycleOf(s, single)
  if (set.length < 2) return false
  const tid = applyId(stepLayout(set, i < 0 ? null : set[i].id, dir).id, single)
  st.update((d) => mapSpreadFreezing(d, si, (sp) => {
    const own = sp.frames.filter(ownPhotoFrame)
    return { ...sp, template: tid, frames: [...rebindFrames(own, framesFromTemplate(tid)), ...sp.frames.filter((f) => !ownPhotoFrame(f))] }
  }), "Change layout", `cycle:${s.id}`)
  return true
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el?.closest?.("input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit],[type=color],[type=file]),textarea,select,[contenteditable=true]")
}

/** ⇧[ previous, ⇧] next (physical brackets + Shift only; D2). Bare `[` `]` stay the panel toggles, Ctrl/⌘ brackets z-order.
 *  The keys act under the pill's conditions except the room above, and prevent the default only when they act. */
export function useLayoutCycleKeys() {
  const st = useStudio()
  const ref = React.useRef(st)
  ref.current = st
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const dir = e.code === "BracketRight" ? 1 : e.code === "BracketLeft" ? -1 : 0
      if (!dir || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const s = ref.current
      // a modal over the editor (the demo's site Preview, dialogs) owns the keys; so do a live marquee and a text edit
      if (!cycleReady(s) || document.querySelector('[aria-modal="true"], [data-testid="editor"] :is([data-testid="marquee"], [data-testid="text-edit"])')) return
      if (cycleLayout(s, dir)) e.preventDefault()
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
}

const CSS = `
.layout-cycle { position: absolute; bottom: calc(100% + 8px); z-index: 20; transform: translateX(-50%); display: inline-flex; align-items: center; box-sizing: border-box; height: 28px; padding: 2px; border-radius: var(--radius-md); background: var(--chrome); box-shadow: 0 0 0 1px var(--card-edge), 0 1px 2px rgb(20 20 19 / .06); white-space: nowrap; font-family: Inter, ui-sans-serif, system-ui, sans-serif; cursor: default }
.layout-cycle > button { appearance: none; border: 0; margin: 0; padding: 0; background: transparent; font: inherit; box-sizing: border-box; position: relative; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: ${SUB}; cursor: default }
.layout-cycle > button svg { width: 16px; height: 16px }
.layout-cycle > button:hover { background: var(--field); color: ${T} }
.layout-cycle > button:active { background: var(--accent); color: ${T}; transform: scale(.98) }
.layout-cycle > button:focus-visible { outline: 2px solid var(--t-ink-hover); outline-offset: 2px }
.layout-cycle > button > .e7-tt { top: auto; bottom: calc(100% + 6px) }
.layout-cycle .lc-name { display: grid; padding: 0 6px; font-size: 12px; font-weight: 500; line-height: 16px; color: ${T} }
.layout-cycle .lc-name > span { grid-area: 1 / 1; text-align: center }
.layout-cycle .lc-name > .lc-w { visibility: hidden }
.layout-cycle .lc-name.lc-custom > span { color: ${SUB} }
.layout-cycle .lc-pos { padding-right: 6px; font-size: 12px; font-weight: 400; line-height: 16px; color: ${SUB}; font-variant-numeric: tabular-nums }
[data-stack-item]:has([data-testid="marquee"], [data-testid="text-edit"]) > .layout-cycle { display: none }
`

/** The pill of stacked spread `si` (the caller renders it for the current spread when the gap above has room). */
export function LayoutCycle({ si }: { si: number }) {
  const st = useStudio()
  const mine = useCustomTemplates()
  const s = st.doc.spreads[si]
  if (!s || si !== st.cur || !cycleReady(st)) return null
  const single = si === 0
  const { set, i, name } = cycleOf(s, single, mine)
  if (set.length < 2) return null
  const pos = `${i < 0 ? "–" : i + 1}/${set.length}`
  const tip = (label: string, key: string) => <span className="e7-tt" aria-hidden>{label}<kbd>{key}</kbd></span>
  return (
    // page 1 is the right half of slot 0: centre on that page, not the slot (Spec "Position")
    <div className="layout-cycle" role="group" aria-label="Layout" data-testid="layout-cycle" style={{ left: single ? "75%" : "50%" }}
      onPointerDown={(e) => e.stopPropagation()}>
      <style>{CSS}</style>
      <button type="button" className="e7-tip" aria-label="Previous layout" data-testid="layout-cycle-prev" onClick={() => cycleLayout(st, -1)}>
        <ChevronLeft strokeWidth={2} />{tip("Previous layout", "⇧[")}
      </button>
      <span className={cn("lc-name", i < 0 && "lc-custom")} aria-hidden>
        {set.map((t) => <span key={t.id} className="lc-w">{t.name}</span>)}
        <span data-testid="layout-cycle-name">{name}</span>
      </span>
      <span className="lc-pos" aria-hidden data-testid="layout-cycle-pos">{pos}</span>
      <button type="button" className="e7-tip" aria-label="Next layout" data-testid="layout-cycle-next" onClick={() => cycleLayout(st, 1)}>
        <ChevronRight strokeWidth={2} />{tip("Next layout", "⇧]")}
      </button>
      <span className="sr-only" aria-live="polite">{`${name}, ${i < 0 ? "–" : i + 1} of ${set.length}`}</span>
    </div>
  )
}

/* Camera / pasteboard around SpreadSurface: fit + zoom + pan, mm rulers, guide creation, stacked pasteboard. */
import * as React from "react"
import { useDrop } from "react-aria"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SW, SH, PAGE, clamp, round, uid, spread, type Guide } from "./model"
import { useStudio, mapSpread, useKeys } from "./store"
import { SpreadSurface, PHOTO_TYPE, readItems } from "./canvas"
import { bestTemplate } from "./templates"
import { CoverSpread, EndpaperSpread, MasterSpread, LastPage, MASTERS, useMasters, coverW, pagesOf, pageLabel, SPINE, T, SUB, setCoverPhoto } from "./v7"
import type { Node } from "./store"

/* v0.7.1: page labels live in the canvas layer under the spread and move with zoom and pan */
function PageLabels({ nd, si }: { nd: Node; si: number }) {
  const st = useStudio(), b = st.book, cw = coverW(b), n = st.doc.spreads.length
  const labels: [string, number][] = nd?.k === "cover" ? [["Back", b.w / cw], ["Spine", SPINE / cw], ["Front", b.w / cw]]
    : nd?.k === "endpaper" ? [["Endpaper", 1]] : nd?.k === "master" ? [[`Master ${nd.id}`, 1]] : nd?.k === "last" ? [[`${pagesOf(n)}`, .5], ["", .5]]
    : si === 0 ? [["", .5], ["1", .5]] : [[`${si * 2}`, .5], [`${si * 2 + 1}`, .5]]
  return <div className="pointer-events-none absolute inset-x-0 top-full flex pt-2.5 text-xs tabular-nums" style={{ color: SUB }} aria-hidden data-testid="page-labels">
    {labels.map(([t, w], i) => <span key={i} className="whitespace-nowrap text-center" style={{ width: `${w * 100}%` }}>{t}</span>)}</div>
}

/* v0.9 §4: cover accepts filmstrip drag — only way to place/replace the cover photo */
function CoverDrop() {
  const st = useStudio()
  const ref = React.useRef<HTMLDivElement>(null)
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (t) => (t.has(PHOTO_TYPE) ? "copy" : "cancel"),
    onDrop: async (e) => {
      const { photos } = await readItems(e.items)
      if (!photos.length) return
      setCoverPhoto(photos[0])
      st.setStatus(`Cover photo set · ${photos[0]}`)
    },
  })
  return (
    <div ref={ref} {...dropProps} className={cn("size-full", isDropTarget && "outline-2 outline-offset-2 outline-mark [outline-style:dashed]")} data-testid="cover-drop">
      <CoverSpread big />
    </div>
  )
}

function useSize<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [s, setS] = React.useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setS({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setS({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return [ref, s] as const
}

export function useEditorKeys() {
  const st = useStudio()
  useKeys((e) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); st.redo(); return }
    if (e.key === "Escape") { if (st.cropId) st.setCropId(null); else if (st.sel.length) st.setSel([]); else st.setNode({ k: "none" }); return }
    if (mod && e.key === "'") { e.preventDefault(); st.setView({ grid: !st.view.grid }); return }
    if (mod && e.key === ";") { e.preventDefault(); st.setView({ guides: !st.view.guides }); return }
    if (e.shiftKey && e.key.toLowerCase() === "r" && !mod) { st.setView({ rulers: !st.view.rulers }); return }
    if (e.shiftKey && e.key.toLowerCase() === "s" && !mod) { st.setView({ snap: !st.view.snap }); return }
    if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); st.setView({ zoom: clamp(st.view.zoom * 1.25, 0.25, 8) }); return }
    if (mod && e.key === "-") { e.preventDefault(); st.setView({ zoom: clamp(st.view.zoom / 1.25, 0.25, 8) }); return }
    if (mod && e.key === "0") { e.preventDefault(); st.setView({ zoom: 1 }); return }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (arrows[e.key] && st.sel.length && (st.features.handles || st.cropId)) {
      e.preventDefault()
      const [dx, dy] = arrows[e.key]; const k = e.shiftKey ? 10 : 1
      if (st.cropId) st.update((d) => mapSpread(d, st.cur, (s) => ({ ...s, frames: s.frames.map((f) => f.id === st.cropId ? { ...f, ox: clamp(f.ox - dx * 0.05 * k, -1, 1), oy: clamp(f.oy - dy * 0.05 * k, -1, 1) } : f) })), "Nudge photo", "nudge-crop")
      else st.update((d) => mapSpread(d, st.cur, (s) => ({ ...s, frames: s.frames.map((f) => st.sel.includes(f.id) && !f.locked ? { ...f, x: round(f.x + dx * k, 2), y: round(f.y + dy * k, 2) } : f) })), "Nudge", "nudge")
      return
    }
    if (e.key === "ArrowRight" && !st.sel.length) st.setCur(Math.min(st.doc.spreads.length - 1, st.cur + 1))
    if (e.key === "ArrowLeft" && !st.sel.length) st.setCur(Math.max(0, st.cur - 1))
  }, [st])
}

const RULER = 22
function Ruler({ axis, origin, sc, len, cursor, onDown }: { axis: "x" | "y"; origin: number; sc: number; len: number; cursor?: number | null; onDown: (e: React.PointerEvent) => void }) {
  const step = sc > 2.4 ? 5 : sc > 1.2 ? 10 : 20
  const ticks: React.ReactNode[] = []
  const from = Math.floor(-origin / sc / step) * step - step, to = Math.ceil((len - origin) / sc / step) * step + step
  for (let mm = from; mm <= to; mm += step / 5) {
    const p = origin + mm * sc
    if (p < 0 || p > len) continue
    const major = Math.abs(mm % step) < 1e-6
    const local = axis === "x" ? ((mm % PAGE) + PAGE) % PAGE : mm
    ticks.push(
      <React.Fragment key={mm}>
        <span className={cn("absolute bg-muted-foreground/50", axis === "x" ? "bottom-0 w-px" : "right-0 h-px")} style={axis === "x" ? { left: p, height: major ? 9 : 4 } : { top: p, width: major ? 9 : 4 }} />
        {major && <span className={cn("absolute text-2xs tabular-nums text-muted-foreground", axis === "y" && "[writing-mode:vertical-rl] rotate-180")} style={axis === "x" ? { left: p + 2, top: 1 } : { top: p + 2, left: 2 }}>{round(axis === "x" && mm === PAGE ? 0 : local)}</span>}
      </React.Fragment>,
    )
  }
  return (
    <div onPointerDown={onDown} data-testid={`ruler-${axis}`} title="Drag to create a guide"
      className={cn("absolute z-30 overflow-hidden bg-chrome", axis === "x" ? "left-[22px] right-0 top-0 h-[22px] cursor-s-resize" : "bottom-0 left-0 top-[22px] w-[22px] cursor-e-resize")}>
      {ticks}
      {axis === "x" && <span className="absolute bottom-0 h-full w-px bg-select/50" style={{ left: origin + SW / 2 * sc }} />}
      {cursor != null && <span className={cn("absolute bg-bleed", axis === "x" ? "top-0 h-full w-px" : "left-0 h-px w-full")} style={axis === "x" ? { left: cursor } : { top: cursor }} />}
    </div>
  )
}

export const FIT_TOP = 56, FIT_BOTTOM = 48
export function Viewport({ className, children, pad = 40, stackGap = 44 }: { className?: string; children?: React.ReactNode; pad?: number; stackGap?: number }) {
  const st = useStudio(), masters = useMasters()
  const { view } = st
  useEditorKeys()
  const [ref, size] = useSize<HTMLDivElement>()
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null)
  const [newGuide, setNewGuide] = React.useState<Guide | null>(null)
  const [space, setSpace] = React.useState(false)
  const r = view.rulers ? RULER : 0
  // v5.1: Fit leaves more air ABOVE the spread than below — top band FIT_TOP (≥ 48 px), bottom band FIT_BOTTOM
  // (page labels + floating pager); the spread is centred inside that band, so top air ≥ bottom air at any size.
  const fitTop = Math.max(FIT_TOP, pad), fitBottom = Math.max(FIT_BOTTOM, pad)
  const nd = st.node && ["cover", "endpaper", "master", "last"].includes(st.node.k) ? st.node : st.mode === "masters" ? { k: "master" as const, id: "A" as const } : null
  const k = nd?.k === "cover" ? coverW(st.book) / (2 * st.book.w) : 1, VW = SW * k
  const fit = Math.max(0.2, Math.min((size.w - r - pad * 2) / VW, (size.h - r - fitTop - fitBottom) / SH))
  const sc = fit * view.zoom
  const ox = r + (size.w - r) / 2 - VW * sc / 2 + pan.x, oy = r + fitTop + (size.h - r - fitTop - fitBottom) / 2 - SH * sc / 2 + pan.y
  React.useEffect(() => { if (view.zoom === 1) setPan({ x: 0, y: 0 }) }, [view.zoom])
  React.useEffect(() => {
    // v0.9.2: always preventDefault on Space outside fields (not only when target===body) so page/canvas chrome never scrolls or flashes a focus ring
    const typing = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.("input,textarea,[contenteditable=true]")
    const d = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return
      if (e.type === "keydown") e.preventDefault()
      setSpace(e.type === "keydown")
    }
    const clear = () => setSpace(false)
    window.addEventListener("keydown", d); window.addEventListener("keyup", d); window.addEventListener("blur", clear)
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", d); window.removeEventListener("blur", clear) }
  }, [])
  const local = (e: { clientX: number; clientY: number }) => { const b = ref.current!.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top } }
  const toMm = (p: { x: number; y: number }) => ({ x: (p.x - ox) / sc, y: (p.y - oy) / sc })

  /* v0.9 §8: wheel / pinch always zooms to cursor; pan is Space+drag, middle-button, or hand tool.
     Native non-passive listener — React's onWheel is passive and cannot preventDefault (console error). */
  React.useEffect(() => {
    const el = ref.current; if (!el || st.features.stack) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e); const z0 = view.zoom
      const z = clamp(z0 * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.25, 8)
      const k = z / z0
      const cx = r + (size.w - r) / 2, cy = r + (size.h - r) / 2
      setPan((pn) => ({ x: (p.x - cx) - (p.x - cx - pn.x) * k, y: (p.y - cy) - (p.y - cy - pn.y) * k }))
      st.setView({ zoom: round(z, 3) })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [st.features.stack, view.zoom, size.w, size.h, r, ox, oy, sc])
  const onPanDown = (e: React.PointerEvent) => {
    if (!(view.tool === "hand" || space || e.button === 1)) return
    e.preventDefault(); e.stopPropagation()
    const s0 = { x: e.clientX, y: e.clientY }, p0 = pan
    const mv = (ev: PointerEvent) => setPan({ x: p0.x + ev.clientX - s0.x, y: p0.y + ev.clientY - s0.y })
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
  }
  const si = st.cur
  const guideDrag = (e: React.PointerEvent, axis: "v" | "h", existing?: Guide) => {
    e.preventDefault(); e.stopPropagation()
    const id = existing?.id ?? uid("g")
    const scope = st.features.parentEdit ? "parent" : existing?.scope ?? "spread"
    const mv = (ev: PointerEvent) => {
      const m = toMm(local(ev)); const pos = round(axis === "v" ? m.x : m.y, 1)
      setNewGuide({ id, axis, pos, scope }); setCursor(local(ev))
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up)
      const m = toMm(local(ev)); const pos = round(axis === "v" ? m.x : m.y, 1)
      const p = local(ev)
      const onRuler = view.rulers && (axis === "v" ? p.y < RULER : p.x < RULER)
      const inRange = axis === "v" ? pos > -20 && pos < SW + 20 : pos > -20 && pos < SH + 20
      setNewGuide(null)
      if (existing && (onRuler || !inRange)) { removeGuide(id); st.setStatus("Guide removed"); return }
      if (!inRange || onRuler) return
      const g: Guide = { id, axis, pos, scope }
      if (st.features.parentEdit) {
        const pid = st.features.parentEdit
        st.update((d) => ({ ...d, parents: d.parents.map((pp) => pp.id === pid ? { ...pp, guides: [...pp.guides.filter((x) => x.id !== id), g] } : pp) }), existing ? "Move parent guide" : "Add parent guide")
      } else st.update((d) => mapSpread(d, si, (s) => ({ ...s, guides: [...s.guides.filter((x) => x.id !== id), { ...existing, ...g }] })), existing ? "Move guide" : "Add guide")
      st.setStatus(`${axis === "v" ? "Vertical" : "Horizontal"} guide at ${axis === "v" ? round(pos % PAGE === 0 && pos ? PAGE : pos % PAGE) : pos} mm${axis === "v" ? (pos >= PAGE ? " (right page)" : " (left page)") : ""}`)
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
  }
  const removeGuide = (id: string) => {
    if (st.features.parentEdit) { const pid = st.features.parentEdit; st.update((d) => ({ ...d, parents: d.parents.map((pp) => pp.id === pid ? { ...pp, guides: pp.guides.filter((x) => x.id !== id) } : pp) }), "Delete guide") }
    else st.update((d) => mapSpread(d, si, (s) => ({ ...s, guides: s.guides.filter((x) => x.id !== id) })), "Delete guide")
  }
  const onGuideDown = (e: React.PointerEvent, id: string, inherited: boolean) => {
    const s = st.doc.spreads[si]
    const par = st.features.parentEdit ? st.doc.parents.find((p) => p.id === st.features.parentEdit) : undefined
    const g = (par?.guides ?? []).find((x) => x.id === id) ?? s.guides.find((x) => x.id === id)
    if (inherited && !st.features.parentEdit) { e.stopPropagation(); st.setStatus("Guide from the parent spread — edit it on the parent, or Alt+click to override"); return }
    if (!g) return
    if (g.locked) { e.stopPropagation(); st.setStatus("Guide is locked"); return }
    guideDrag(e, g.axis, g)
  }

  if (st.features.stack) return <Stack className={className} gap={stackGap}>{children}</Stack>
  return (
    <div ref={ref} onPointerDownCapture={onPanDown} onPointerMove={(e) => view.rulers && setCursor(local(e))} onPointerLeave={() => setCursor(null)}
      className={cn("canvas-dots relative min-h-0 flex-1 overflow-hidden",
        (view.tool === "hand" || space) && "cursor-grab",
        !space && view.tool === "frame" && "cursor-tool-frame",
        !space && view.tool === "text" && "cursor-tool-text",
        className)} data-testid="viewport">
      {size.w > 0 && (
        <div className="absolute" style={{ left: ox, top: oy, width: VW * sc, height: SH * sc }} data-testid="spread-layer">
          {nd ? <div className="size-full" data-testid="node-view">{nd.k === "cover" ? <CoverDrop /> : nd.k === "endpaper" ? <EndpaperSpread big which={nd.w} /> : nd.k === "master" ? <MasterSpread big id={nd.id} m={masters[nd.id]} /> : <LastPage big />}</div>
            : <SpreadSurface si={si} sc={sc} onGuideDown={onGuideDown} />}
          {!nd && newGuide && <div className={cn("pointer-events-none absolute z-50 bg-guide", newGuide.axis === "v" ? "w-px" : "h-px")} style={newGuide.axis === "v" ? { left: newGuide.pos * sc, top: -40, height: SH * sc + 80 } : { top: newGuide.pos * sc, left: -40, width: SW * sc + 80 }}>
            <span className="absolute whitespace-nowrap rounded-xs bg-guide-solid px-1.5 py-px text-2xs font-semibold text-white" style={newGuide.axis === "v" ? { left: 4, top: 0 } : { left: 0, top: 4 }}>{newGuide.pos} mm</span>
          </div>}
          {!view.preview && <PageLabels nd={nd} si={si} />}
        </div>
      )}
      {view.rulers && (
        <>
          <Ruler axis="x" origin={ox - RULER} sc={sc} len={size.w - RULER} cursor={cursor ? cursor.x - RULER : null} onDown={(e) => guideDrag(e, "h")} />
          <Ruler axis="y" origin={oy - RULER} sc={sc} len={size.h - RULER} cursor={cursor ? cursor.y - RULER : null} onDown={(e) => guideDrag(e, "v")} />
          <div className="absolute left-0 top-0 z-30 grid size-[22px] place-items-center bg-chrome text-2xs font-semibold text-muted-foreground">mm</div>
        </>
      )}
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- stacked pasteboard */
function GapDrop({ index }: { index: number }) {
  const st = useStudio()
  const ref = React.useRef<HTMLDivElement>(null)
  const { dropProps, isDropTarget } = useDrop({
    ref, isDisabled: !st.features.multiDrop,
    getDropOperation: (t) => (t.has(PHOTO_TYPE) ? "copy" : "cancel"),
    onDrop: async (e) => {
      const { photos } = await readItems(e.items)
      if (!photos.length) return
      const t = bestTemplate(photos)
      const ns = spread(t.id, photos)
      st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, index), ns, ...d.spreads.slice(index)] }), "New spread from drop")
      st.setCur(index)
      st.setStatus(`New spread ${index + 1} with “${t.name}” — best fit for ${photos.length} photo${photos.length > 1 ? "s" : ""}`)
    },
  })
  return (
    <div ref={ref} {...dropProps} data-testid="gap-drop" className={cn("relative flex w-full items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,transform]", st.dragging && st.features.multiDrop ? "h-11" : "h-0")}>
      {st.dragging && st.features.multiDrop && (
        <div className={cn("flex h-8 w-[60%] items-center justify-center gap-1.5 rounded-lg bg-white/50 text-xs text-muted-foreground-on-app", isDropTarget && "bg-white/80 text-foreground")}>
          <Plus className="size-3.5" />Drop here for a new spread
        </div>
      )}
    </div>
  )
}
function Stack({ className, gap, children }: { className?: string; gap: number; children?: React.ReactNode }) {
  const st = useStudio()
  const [ref, size] = useSize<HTMLDivElement>()
  const sc = Math.max(0.3, Math.min((size.w - 80) / SW, (size.h - FIT_TOP - FIT_BOTTOM) / SH)) * st.view.zoom // v5.1: FIT_TOP air above the first spread ≥ air below it
  React.useEffect(() => {
    const el = ref.current?.querySelector(`[data-stack-item="${st.cur}"]`) as HTMLElement | null
    if (!el || !ref.current) return
    const c = ref.current, top = el.offsetTop - 24
    if (top < c.scrollTop || top + el.offsetHeight > c.scrollTop + c.clientHeight) c.scrollTo({ top, behavior: "smooth" })
  }, [st.cur, ref])
  // proto: scrollbars are hidden, so panning is explicit — wheel / trackpad scrolls, Space+drag, the Hand tool or middle-drag pan
  const [space, setSpace] = React.useState(false)
  React.useEffect(() => {
    // v0.9.2: Stack path — same Space preventDefault as Viewport
    const typing = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.("input,textarea,[contenteditable=true]")
    const d = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return
      if (e.type === "keydown") e.preventDefault()
      setSpace(e.type === "keydown")
    }
    const clear = () => setSpace(false)
    window.addEventListener("keydown", d); window.addEventListener("keyup", d); window.addEventListener("blur", clear)
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", d); window.removeEventListener("blur", clear) }
  }, [])
  const onPanDown = (e: React.PointerEvent) => {
    const c = ref.current
    if (!c || !(st.view.tool === "hand" || space || e.button === 1)) return
    e.preventDefault(); e.stopPropagation()
    const s0 = { x: e.clientX, y: e.clientY, l: c.scrollLeft, t: c.scrollTop }
    const mv = (ev: PointerEvent) => { c.scrollLeft = s0.l - (ev.clientX - s0.x); c.scrollTop = s0.t - (ev.clientY - s0.y) }
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
  }
  React.useEffect(() => {
    const el = ref.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      st.setView({ zoom: round(clamp(st.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.5, 3), 3) })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [st.view.zoom])
  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div ref={ref} onPointerDownCapture={onPanDown} className={cn("canvas-dots no-scrollbar absolute inset-0 overflow-auto",
          (st.view.tool === "hand" || space) && "cursor-grab",
          !space && st.view.tool === "frame" && "cursor-tool-frame",
          !space && st.view.tool === "text" && "cursor-tool-text")} data-testid="pasteboard">
        <div className="flex min-w-max flex-col items-center px-10 pb-16 pt-14" style={{ gap: st.dragging && st.features.multiDrop ? 0 : gap }}>
          {size.w > 0 && st.doc.spreads.map((_, i) => (
            <React.Fragment key={st.doc.spreads[i].id}>
              {i > 0 && <GapDrop index={i} />}
              <div data-stack-item={i} className="flex flex-col items-center gap-3">
                <SpreadSurface si={i} sc={sc} active={i === st.cur} />
                <span className={cn("text-2xs tabular-nums", i === st.cur && "font-semibold")} style={{ color: i === st.cur ? T : SUB, paddingLeft: i === 0 ? SW * sc / 2 : undefined }}>{pageLabel(i)}</span>
              </div>
            </React.Fragment>
          ))}
          <GapDrop index={st.doc.spreads.length} />
        </div>
      </div>
      {children}
    </div>
  )
}

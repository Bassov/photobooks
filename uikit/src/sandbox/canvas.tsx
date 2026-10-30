/* Sandbox canvas: spread surface with frames, crop, handles, snapping, guides, rulers, grid, print overlays. */
import { useMasters } from "./v7"
import * as React from "react"
import { useDrop, useDrag, type DropItem } from "react-aria"
import { AlertTriangle, ImagePlus, Lock, Link2 } from "lucide-react"
import { TT, useTemplatePreview } from "./templates"
import { cn } from "@/lib/utils"
import { P } from "@/data"
import {
  SW, SH, PAGE, type Frame, type Spread, type Rect, type SnapLine, type Anchor, anchors, snapRect, resolveGrid, effectiveGrid,
  allGuides, clamp, round, effectiveDpi, orientedSize, photoOf, uid, framesFromTemplate,
  parentOf, pageNumbersOf, type Guide,
} from "./model"
import { useStudio, mapSpread, mapFrames, type Studio } from "./store"
import { fillTokens } from "./meta"

export const PHOTO_TYPE = "application/x-photobooks-photo"
export const FRAME_TYPE = "application/x-photobooks-frame"

/* ---------------------------------------------------------------- photo inside a frame (cover × zoom, pan, quarter turn, straighten) */
export function PhotoImg({ f, wpx, hpx, ghost = false }: { f: Frame; wpx: number; hpx: number; ghost?: boolean }) {
  const p = photoOf(f.photo)
  if (!p || wpx <= 0 || hpx <= 0) return null
  const o = orientedSize(p, f.qt)
  const a = Math.abs(f.straighten) * Math.PI / 180
  const k = f.straighten ? Math.cos(a) + Math.sin(a) * Math.max(wpx / hpx, hpx / wpx) : 1
  const s = (f.fit === "fit" ? Math.min(wpx / o.w, hpx / o.h) : Math.max(wpx / o.w, hpx / o.h)) * f.zoom
  const dw = o.w * s, dh = o.h * s
  const left = (wpx - dw) / 2 + f.ox * (dw - wpx) / 2, top = (hpx - dh) / 2 + f.oy * (dh - hpx) / 2
  const iw = f.qt % 180 ? dh : dw, ih = f.qt % 180 ? dw : dh
  const cx = left + dw / 2, cy = top + dh / 2
  return (
    <img src={p.src} alt="" draggable={false}
      className={cn("pointer-events-none absolute max-w-none select-none", ghost && "opacity-30")}
      style={{ left: cx - iw / 2, top: cy - ih / 2, width: iw, height: ih, transform: `rotate(${f.qt + f.straighten}deg) scale(${k * (f.flipH ? -1 : 1)}, ${k * (f.flipV ? -1 : 1)})`,
        filter: f.adj ? `brightness(${1 + f.adj.b / 100}) contrast(${1 + f.adj.c / 100}) saturate(${1 + f.adj.s / 100})` : undefined }} />
  )
}

const TEXT = {
  title: { font: "var(--font-display, 'Lora Variable'), Georgia, serif", size: 9, weight: 500, lh: 1.15 },
  caption: { font: "'Inter Variable', system-ui, sans-serif", size: 3.1, weight: 400, lh: 1.4 },
  body: { font: "'Inter Variable', system-ui, sans-serif", size: 3.6, weight: 400, lh: 1.5 },
}

/* ---------------------------------------------------------------- one frame */
function FrameBody({ f, s, sc, missing, inherited, editing, onEditDone }: {
  f: Frame; s: Spread; sc: number; missing: boolean; inherited?: boolean; editing?: boolean; onEditDone?: (t: string) => void
}) {
  const st = useStudio()
  const style = f.styleId ? st.doc.styles.find((x) => x.id === f.styleId) : undefined
  const mat = (style?.mat ?? 0) * sc
  const wpx = f.w * sc - mat * 2, hpx = f.h * sc - mat * 2
  if (f.kind === "text") {
    const t = TEXT[f.textStyle ?? "caption"]
    const anchorPhoto = f.anchor ? s.frames.find((x) => x.id === f.anchor)?.photo ?? null : null
    const text = f.live ? fillTokens(f.text ?? "", anchorPhoto) : f.text ?? ""
    const css: React.CSSProperties = { fontFamily: t.font, fontSize: t.size * sc, fontWeight: t.weight, lineHeight: t.lh, textAlign: f.align ?? "left", color: "#232220" }
    if (editing) return (
      <textarea autoFocus defaultValue={f.text} aria-label="Text" onBlur={(e) => onEditDone?.(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) (e.currentTarget as HTMLTextAreaElement).blur(); e.stopPropagation() }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute inset-0 resize-none bg-white/70 p-0 outline-hidden" style={css} />
    )
    return <div className="absolute inset-0 overflow-hidden whitespace-pre-wrap" style={css}>{text || <span className="opacity-40">Empty text</span>}</div>
  }
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: style?.mat ? "#fff" : undefined, borderRadius: (style?.radius ?? 0) * sc, boxShadow: style?.shadow ? "0 1px 3px rgb(0 0 0 / .18)" : undefined, outline: style?.stroke ? `${Math.max(1, style.stroke * sc)}px solid ${style.strokeColor}` : undefined, outlineOffset: style?.stroke ? -Math.max(1, style.stroke * sc) : undefined }}>
      <div className="absolute overflow-hidden" style={{ left: mat, top: mat, width: wpx, height: hpx, borderRadius: Math.max(0, (style?.radius ?? 0) * sc - mat) }}>
        {f.photo && !missing ? <PhotoImg f={f} wpx={wpx} hpx={hpx} />
          : missing ? (
            <div className="flex size-full flex-col items-center justify-center gap-1 hatch-missing text-2xs text-ink-warning">
              <AlertTriangle className="size-4" />{f.w * sc > 110 && <span className="font-medium">{P(f.photo!).name} not found</span>}
            </div>
          ) : (
            <div className={cn("flex size-full flex-col items-center justify-center gap-1 bg-placeholder text-placeholder-fg", inherited && " bg-parent-tint")}>
              {f.w * sc > 46 && <ImagePlus className="size-4 opacity-70" />}
              {f.w * sc > 110 && <span className="text-2xs">{inherited ? "Parent frame" : "Drop photo"}</span>}
            </div>
          )}
      </div>
    </div>
  )
}

type FrameProps = {
  f: Frame; si: number; s: Spread; sc: number; selected: boolean; inherited?: boolean; hidden?: boolean
  onDown: (e: React.PointerEvent, f: Frame) => void; onDouble: (f: Frame) => void
  editing: boolean; onEditDone: (t: string) => void
}
function FrameEl(p: FrameProps) {
  const st = useStudio()
  const { f, sc } = p
  const ref = React.useRef<HTMLDivElement>(null)
  const missing = !!f.photo && st.missing.has(f.photo)
  const canDrop = !!(st.features.drop || st.features.swap || st.features.multiDrop) && f.kind === "image" && !p.inherited && !f.locked
  const { dropProps, isDropTarget } = useDrop({
    ref, isDisabled: !canDrop,
    getDropOperation: (types) => (types.has(PHOTO_TYPE) || types.has(FRAME_TYPE) ? "move" : "cancel"),
    onDrop: async (e) => { await handleDrop(st, p.si, f.id, e.items) },
  })
  const { dragProps, isDragging } = useDrag({
    isDisabled: !st.features.swap || !f.photo || p.inherited,
    getItems: () => [{ [FRAME_TYPE]: `${p.si}:${f.id}`, "text/plain": f.photo ? P(f.photo).name : "" }],
    onDragStart: () => st.setStatus("Drag onto another frame to swap, or onto the filmstrip to take the photo back"),
    onDragEnd: () => st.setStatus(""),
  })
  const crop = st.cropId === f.id
  const dpi = st.view.dpi && f.kind === "image" ? effectiveDpi(f) : null
  return (
    <div ref={ref} {...(canDrop ? dropProps : {})} {...(st.features.swap && f.photo && !p.inherited ? dragProps : {})}
      data-frame={f.id} data-testid={p.inherited ? "master-frame" : "frame"}
      onPointerDown={(e) => p.onDown(e, f)} onDoubleClick={() => p.onDouble(f)}
      className={cn("group/frame absolute", p.inherited ? cn("z-10", st.features.overrides && st.view.tool === "select" && !st.view.preview ? "cursor-default" : "pointer-events-none") : "", isDragging && "opacity-40", p.hidden && "opacity-0")}
      style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined, zIndex: crop ? 30 : undefined }}>
      {crop && <div className="pointer-events-none absolute inset-0 overflow-visible"><PhotoImg f={f} wpx={f.w * sc} hpx={f.h * sc} ghost /></div>}
      <FrameBody f={f} s={p.s} sc={sc} missing={missing} inherited={p.inherited} editing={p.editing} onEditDone={p.onEditDone} />
      {f.kind === "image" && f.caption && <div data-testid="frame-caption" className="pointer-events-none absolute inset-x-0 truncate" style={{ top: f.h * sc + 1.5 * sc, fontSize: TEXT.caption.size * sc, fontFamily: TEXT.caption.font, color: "#535152", lineHeight: 1.3 }}>{f.caption}</div>}
      {!p.selected && !p.inherited && <div className="pointer-events-none absolute inset-0 outline-1 outline-select/0 transition-[outline-color] group-hover/frame:outline-select/70 [outline-style:solid]" />}
      {p.inherited && !st.view.preview && <div data-allow-border className="pointer-events-none absolute inset-0 outline-1 outline-offset-0 outline-parent-soft [outline-style:dashed]" />}
      {f.overrides && !st.view.preview && <span className="pointer-events-none absolute left-1 top-1 inline-flex items-center gap-1 rounded-xs bg-parent px-1 py-px text-2xs font-semibold text-white"><Link2 className="size-2.5" />override</span>}
      {isDropTarget && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-parent/20 pt-2 outline-2 outline-select [outline-style:solid]">
          <span className="rounded-md bg-field px-2 py-0.5 text-2xs font-medium text-foreground shadow">{f.photo ? "Release to replace" : "Release to place"}</span>
        </div>
      )}
      {st.dragging && canDrop && !isDropTarget && !f.photo && <div className="pointer-events-none absolute inset-0 bg-parent/10 outline-1 outline-select/60 [outline-style:dashed]" />}
      {f.locked && !st.view.preview && <span className="pointer-events-none absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/55 text-white"><Lock className="size-3" /></span>}
      {dpi !== null && dpi < 300 && !st.view.preview && (
        <span className={cn("pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-xs bg-field px-1.5 py-0.5 text-2xs text-ink-warning shadow-sm", dpi < 150 ? "font-semibold" : "font-medium")} data-testid="dpi-badge">
          <AlertTriangle className="size-2.5" />{dpi} dpi
        </span>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- drop logic shared by frames, paper and filmstrip */
export async function readItems(items: DropItem[]) {
  const photos: string[] = [], frames: string[] = []
  for (const it of items) {
    if (it.kind !== "text") continue
    if (it.types.has(PHOTO_TYPE)) photos.push(await it.getText(PHOTO_TYPE))
    else if (it.types.has(FRAME_TYPE)) frames.push(await it.getText(FRAME_TYPE))
  }
  return { photos, frames }
}
export async function handleDrop(st: Studio, si: number, frameId: string | null, items: DropItem[]) {
  const { photos, frames } = await readItems(items)
  const sp = st.doc.spreads[si]
  if (frames.length && frameId) {
    const [fsi, fid] = frames[0].split(":"); const a = Number(fsi)
    if (fid === frameId && a === si) return
    const src = st.doc.spreads[a].frames.find((x) => x.id === fid)!
    const dst = sp.frames.find((x) => x.id === frameId)!
    st.update((d) => {
      let n = mapFrames(d, a, [fid], (x) => ({ ...x, photo: dst.photo, zoom: 1, ox: 0, oy: 0 }))
      n = mapFrames(n, si, [frameId], (x) => ({ ...x, photo: src.photo, zoom: 1, ox: 0, oy: 0 }))
      return n
    }, dst.photo ? "Swap photos" : "Move photo")
    st.setStatus(dst.photo ? "Swapped two photos" : "Moved photo to an empty frame")
    st.setSel([frameId]); st.setCur(si)
    return
  }
  if (!photos.length) return
  if (photos.length === 1 || !st.features.multiDrop) {
    if (!frameId) return
    const old = sp.frames.find((x) => x.id === frameId)?.photo
    st.update((d) => mapFrames(d, si, [frameId], (x) => ({ ...x, photo: photos[0], zoom: 1, ox: 0, oy: 0, qt: 0, straighten: 0 })), old ? "Replace photo" : "Place photo")
    st.setStatus(old ? `Replaced ${P(old).name} — it is back in the gallery` : `Placed ${P(photos[0]).name}`)
    st.setSel([frameId]); st.setCur(si)
    return
  }
  // multi-drop: target frame first, then the spread's empty frames in order
  const order = sp.frames.filter((x) => x.kind === "image" && !x.locked && (x.id === frameId || !x.photo))
  if (frameId) order.sort((a, b) => (a.id === frameId ? -1 : b.id === frameId ? 1 : 0))
  const used = photos.slice(0, order.length)
  st.update((d) => mapSpread(d, si, (s) => ({ ...s, frames: s.frames.map((x) => { const k = order.findIndex((o) => o.id === x.id); return k >= 0 && k < used.length ? { ...x, photo: used[k], zoom: 1, ox: 0, oy: 0 } : x }) })), `Fill ${used.length} frames`)
  const left = photos.length - used.length
  st.setStatus(`Placed ${used.length} photos${left ? ` · ${left} did not fit and stay in the gallery` : ""}`)
  st.setCur(si)
}

/* ---------------------------------------------------------------- overlays */
function GridOverlay({ s, sc }: { s: Spread; sc: number }) {
  const st = useStudio(); useMasters()
  const g = effectiveGrid(st.doc, s)
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="grid-overlay">
      {resolveGrid(g).map((p, i) => (
        <React.Fragment key={i}>
          {/* v0.8 §3.4: column guides + row guides (cells read as their intersection) */}
          {p.cols.map((c, ci) => <div key={`c${ci}`} data-testid="grid-col" data-allow-border className="absolute border-x border-(--grid-line)/50 bg-grid" style={{ left: c.x * sc, top: p.content.y * sc, width: c.w * sc, height: p.content.h * sc }} />)}
          {p.rows.map((r, ri) => <div key={`r${ri}`} data-testid="grid-row" data-allow-border className="absolute border-y border-(--grid-line)/50" style={{ left: p.content.x * sc, top: r.y * sc, width: p.content.w * sc, height: r.h * sc }} />)}
          <div data-allow-border className="absolute border-[1.5px] border-dashed border-(--grid-line)" style={{ left: p.content.x * sc, top: p.content.y * sc, width: p.content.w * sc, height: p.content.h * sc }} />
        </React.Fragment>
      ))}
    </div>
  )
}
function PrintOverlay({ sc }: { sc: number }) {
  const bleed = 3 * sc, safe = 6 * sc
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="print-overlay">
      <div data-allow-border className="absolute border border-bleed" style={{ left: -bleed, top: -bleed, right: -bleed, bottom: -bleed }} />
      <span className="absolute rounded-2xs bg-field px-1 text-2xs font-semibold leading-4 text-foreground" style={{ left: -bleed, top: -bleed - 17 }}>bleed 3 mm</span>
      <div className="absolute inset-0 outline-1 outline-black/60 [outline-style:solid]" />
      {[0, 1].map((p) => <div key={p} data-allow-border className="absolute border border-dashed border-guide" style={{ left: p * PAGE * sc + safe, top: safe, width: PAGE * sc - safe * 2, height: SH * sc - safe * 2 }} />)}
      <span className="absolute rounded-2xs bg-field px-1 text-2xs font-semibold leading-4 text-foreground" style={{ left: safe, top: safe + 2 }}>safe 6 mm</span>
      <div className="absolute inset-y-0 w-px bg-black/40" style={{ left: PAGE * sc }} />
    </div>
  )
}

function Handles({ r, sc, rotate, onHandle }: { r: Rect & { rot?: number }; sc: number; rotate: boolean; onHandle: (e: React.PointerEvent, h: string) => void }) {
  const pts: [string, number, number, string][] = [["nw", 0, 0, "nwse-resize"], ["n", 50, 0, "ns-resize"], ["ne", 100, 0, "nesw-resize"], ["w", 0, 50, "ew-resize"], ["e", 100, 50, "ew-resize"], ["sw", 0, 100, "nesw-resize"], ["s", 50, 100, "ns-resize"], ["se", 100, 100, "nwse-resize"]]
  return (
    <div className="pointer-events-none absolute z-40" style={{ left: r.x * sc, top: r.y * sc, width: r.w * sc, height: r.h * sc, transform: r.rot ? `rotate(${r.rot}deg)` : undefined }} data-testid="handles">
      <div className="pointer-events-none absolute inset-0 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]" data-testid="sel-outline" />
      {pts.map(([h, x, y, c]) => (
        <span key={h} onPointerDown={(e) => onHandle(e, h)} data-handle={h} data-testid="sel-handle"
          className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-2xs bg-white" style={{ left: `${x}%`, top: `${y}%`, cursor: c, boxShadow: "0 0 0 1.5px #232223" }} />
      ))}
      {rotate && (
        <>
          <span className="pointer-events-none absolute left-1/2 top-[-22px] h-[20px] w-px bg-select" />
          <span onPointerDown={(e) => onHandle(e, "rot")} data-handle="rot" className="pointer-events-auto absolute left-1/2 top-[-28px] size-3 -translate-x-1/2 cursor-grab rounded-full bg-white" style={{ boxShadow: "0 0 0 1.5px #232223" }} />
        </>
      )}
      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-tag px-1.5 py-0.5 text-2xs font-medium tabular-nums text-white">
        {round(r.w)} × {round(r.h)} mm{r.rot ? ` · ${round(r.rot)}°` : ""}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- spread surface */
/** One guide line with its 7 px grab strip; `inherited` guides come from the parent master (dashed, not draggable on the spread). */
export function GuideLine({ g, sc, onDown }: { g: Guide & { inherited?: boolean }; sc: number; onDown: (e: React.PointerEvent) => void }) {
  return (
    <div data-guide={g.id} onPointerDown={onDown}
      className={cn("absolute z-20", g.axis === "v" ? "inset-y-[-12px] w-[7px] -translate-x-[3px] cursor-ew-resize" : "inset-x-[-12px] h-[7px] -translate-y-[3px] cursor-ns-resize", (g.locked || g.inherited) && "cursor-default")}
      style={g.axis === "v" ? { left: g.pos * sc } : { top: g.pos * sc }}>
      <div className={cn("absolute", g.axis === "v" ? "inset-y-0 left-[3px] w-px" : "inset-x-0 top-[3px] h-px", g.inherited ? "bg-parent-soft [background:repeating-linear-gradient(var(--dir),#a3a1a2_0_4px,transparent_4px_7px)]" : g.scope === "book" ? "bg-portrait" : "bg-guide")}
        style={{ ["--dir" as string]: g.axis === "v" ? "180deg" : "90deg" }} />
    </div>
  )
}
export function SpreadSurface({ si, sc, active = true, onGuideDown, className }: {
  si: number; sc: number; active?: boolean; className?: string
  onGuideDown?: (e: React.PointerEvent, id: string, inherited: boolean) => void
}) {
  const st = useStudio()
  const { doc, features: ft, view } = st
  const s = doc.spreads[si]
  const ref = React.useRef<HTMLDivElement>(null)
  const [lines, setLines] = React.useState<SnapLine[]>([])
  const [marquee, setMarquee] = React.useState<Rect | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const par = parentOf(doc, s)
  const overridden = new Set(s.frames.map((f) => f.overrides).filter(Boolean) as string[])
  const parentFrames = (par?.frames ?? []).filter((f) => !(s.hiddenParent ?? []).includes(f.id) && !overridden.has(f.id))
  const selFrames = s.frames.filter((f) => st.sel.includes(f.id))

  const pt = (e: { clientX: number; clientY: number }) => {
    const b = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - b.left) / sc, y: (e.clientY - b.top) / sc }
  }
  const th = 6 / sc
  const gesture = (e: React.PointerEvent, onMove: (p: { x: number; y: number }, ev: PointerEvent) => void, onUp: (moved: boolean) => void) => {
    const start = pt(e); let moved = false
    const mv = (ev: PointerEvent) => { if (!ref.current) { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); return } const p = pt(ev); if (!moved && Math.hypot(p.x - start.x, p.y - start.y) * sc < 3) return; moved = true; onMove(p, ev) }
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setLines([]); onUp(moved) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
    return start
  }
  const snapOn = view.snap
  const anc = (exclude: string[]) => anchors(doc, s, { grid: view.snapGrid && (view.grid || ft.handles === true), guides: view.snapGuides && view.guides, frames: view.snapFrames, exclude })

  const onFrameDown = (e: React.PointerEvent, f: Frame) => {
    if (e.button !== 0) return
    if (st.cropId && st.cropId !== f.id) st.setCropId(null)
    if (editing === f.id) return
    st.setCur(si)
    if (st.cropId === f.id) { // pan inside the frame
      e.stopPropagation()
      const p0 = { ox: f.ox, oy: f.oy }, ph = photoOf(f.photo)!
      const o = orientedSize(ph, f.qt); const scl = Math.max(f.w / o.w, f.h / o.h) * f.zoom
      const ow = o.w * scl - f.w, oh = o.h * scl - f.h
      const start = gesture(e, (p) => {
        st.preview((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, ox: ow > 0 ? clamp(p0.ox + (p.x - start.x) * 2 / ow, -1, 1) : 0, oy: oh > 0 ? clamp(p0.oy + (p.y - start.y) * 2 / oh, -1, 1) : 0 })))
      }, (m) => m && st.commit("Pan photo"))
      return
    }
    e.stopPropagation()
    let sel = st.sel
    if (e.shiftKey && ft.multi) sel = sel.includes(f.id) ? sel.filter((x) => x !== f.id) : [...sel, f.id]
    else if (!sel.includes(f.id)) sel = [f.id]
    st.setSel(sel)
    // v0.7.3 (P2): a plain click (no drag) on one frame of a multi-selection collapses to that frame, so its toolbar (Crop) shows up
    const collapse = !e.shiftKey && sel.length > 1 && sel.includes(f.id)
    if (!ft.handles || view.tool !== "select") { if (collapse) st.setSel([f.id]); return }
    const moving = s.frames.filter((x) => sel.includes(x.id) && !x.locked)
    if (!moving.length) { if (collapse) st.setSel([f.id]); if (f.locked) st.setStatus("Frame is locked — unlock it in the inspector (Ctrl+Shift+L)"); return }
    const orig = moving.map((x) => ({ id: x.id, x: x.x, y: x.y }))
    const bb = bbox(moving)
    const A = anc(moving.map((x) => x.id))
    const GA = view.grid && view.snapGrid ? (() => { const a = anchors(doc, s, { grid: true, guides: false, frames: false, exclude: [] }); const k = (x: Anchor) => /^(column|row) /.test(x.kind); return { xs: a.xs.filter(k), ys: a.ys.filter(k) } })() : null
    const start = gesture(e, (p, ev) => {
      let dx = p.x - start.x, dy = p.y - start.y
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
      let ls: SnapLine[] = []
      if (snapOn && !ev.altKey) {
        // v0.8.1 (P2-9): with the layout grid visible, column / row edges win within a wider 16px pull, per axis
        const R = { ...bb, x: bb.x + dx, y: bb.y + dy }, r = snapRect(R, A, th)
        const g = GA ? snapRect(R, GA, 16 / sc, { x: ["l", "r"], y: ["t", "b"] }) : null
        const gx = g?.lines.find((l) => l.axis === "v"), gy = g?.lines.find((l) => l.axis === "h")
        dx += gx ? g!.dx : r.dx; dy += gy ? g!.dy : r.dy
        ls = [gx ?? r.lines.find((l) => l.axis === "v"), gy ?? r.lines.find((l) => l.axis === "h")].filter(Boolean) as SnapLine[]
        if (gx || gy) st.setStatus(`Snapped to ${[gx?.kind, gy?.kind].filter(Boolean).join(" · ")}`)
      }
      setLines(ls)
      st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: sp.frames.map((x) => { const o = orig.find((q) => q.id === x.id); return o ? { ...x, x: round(o.x + dx, 2), y: round(o.y + dy, 2) } : x }) })))
    }, (m) => { if (m) { st.commit(moving.length > 1 ? `Move ${moving.length} frames` : "Move frame"); st.setStatus("") } else if (collapse) st.setSel([f.id]) })
  }
  const onHandle = (e: React.PointerEvent, h: string) => {
    e.stopPropagation()
    const f = selFrames[0]; if (!f || f.locked) return
    const o = { x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot }
    const A = anc([f.id])
    if (h === "rot") {
      const c = { x: f.x + f.w / 2, y: f.y + f.h / 2 }
      gesture(e, (p, ev) => {
        let ang = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI + 90
        if (ang > 180) ang -= 360
        ang = ev.shiftKey ? Math.round(ang / 15) * 15 : Math.abs(ang) < 2 ? 0 : round(ang)
        st.preview((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, rot: ang })))
      }, (m) => m && st.commit("Rotate frame"))
      return
    }
    const start = gesture(e, (p, ev) => {
      const dx = p.x - start.x, dy = p.y - start.y
      let { x, y, w, h: hh } = o
      if (h.includes("e")) w = o.w + dx
      if (h.includes("s")) hh = o.h + dy
      if (h.includes("w")) { x = o.x + dx; w = o.w - dx }
      if (h.includes("n")) { y = o.y + dy; hh = o.h - dy }
      if (ev.shiftKey && h.length === 2) { const r = o.w / o.h; if (w / hh > r) w = hh * r; else hh = w / r; if (h.includes("w")) x = o.x + o.w - w; if (h.includes("n")) y = o.y + o.h - hh }
      let ls: SnapLine[] = []
      if (snapOn && !ev.altKey && !o.rot) {
        const ex = (h.includes("e") ? ["r"] : h.includes("w") ? ["l"] : []) as ("l" | "r")[]
        const ey = (h.includes("s") ? ["b"] : h.includes("n") ? ["t"] : []) as ("t" | "b")[]
        const r = snapRect({ x, y, w, h: hh }, A, th, { x: ex, y: ey })
        if (h.includes("e")) w += r.dx; if (h.includes("w")) { x += r.dx; w -= r.dx }
        if (h.includes("s")) hh += r.dy; if (h.includes("n")) { y += r.dy; hh -= r.dy }
        ls = r.lines
      }
      setLines(ls)
      w = Math.max(10, w); hh = Math.max(10, hh)
      st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: sp.frames.map((q) => (q.id === f.id ? { ...q, x: round(x, 2), y: round(y, 2), w: round(w, 2), h: round(hh, 2) } : q)) })))
    }, (m) => m && st.commit("Resize frame"))
  }
  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    st.setCur(si)
    if (st.cropId) { st.setCropId(null); return }
    if (view.tool === "frame" || view.tool === "text") {
      const kind = view.tool
      const id = uid()
      const start = gesture(e, (p) => {
        const r = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
        st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: [...sp.frames.filter((q) => q.id !== id), { id, kind: kind === "text" ? "text" : "image", photo: null, zoom: 1, ox: 0, oy: 0, rot: 0, qt: 0, straighten: 0, text: kind === "text" ? "New text" : undefined, textStyle: "caption", ...r }] })))
      }, (m) => { if (m) { st.commit(kind === "text" ? "Add text frame" : "Add frame"); st.setSel([id]); st.setView({ tool: "select" }) } })
      return
    }
    if (!e.shiftKey) st.setSel([])
    if (!ft.marquee) return
    const start = gesture(e, (p) => setMarquee({ x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }), () => {
      setMarquee((m) => {
        if (m) st.setSel(s.frames.filter((f) => f.x < m.x + m.w && f.x + f.w > m.x && f.y < m.y + m.h && f.y + f.h > m.y).map((f) => f.id))
        return null
      })
    })
  }
  const onDouble = (f: Frame) => {
    if (f.kind === "text" && ft.textEdit) { setEditing(f.id); return }
    if (f.kind === "image" && f.photo && ft.crop) { st.setCropId(f.id); st.setSel([f.id]); st.setStatus("Crop: drag to move the photo, wheel or slider to zoom, Esc to finish") }
  }
  const onWheel = (e: React.WheelEvent) => {
    if (!st.cropId) return
    const f = s.frames.find((x) => x.id === st.cropId); if (!f) return
    e.stopPropagation()
    st.update((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, zoom: round(clamp(x.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 4), 3) })), "Zoom photo", `zoom-${f.id}`)
  }
  // paper drop (multi-drop onto a spread)
  const { dropProps, isDropTarget } = useDrop({
    ref, isDisabled: !ft.multiDrop,
    getDropOperation: (t) => (t.has(PHOTO_TYPE) ? "copy" : "cancel"),
    onDrop: async (e) => { await handleDrop(st, si, null, e.items) },
  })
  const showSel = active && selFrames.length > 0 && !st.cropId && !view.preview
  const single = selFrames.length === 1 ? selFrames[0] : null
  const pn = view.pageNumbers || pageNumbersOf(par)
  const pageNo = (side: 0 | 1) => (doc.pageStart ?? 1) + si * 2 - 1 + side
  return (
    <div ref={ref} {...dropProps} onPointerDown={onBgDown} onWheel={onWheel} data-testid="spread" data-spread={si}
      className={cn("relative shrink-0 select-none", view.preview ? "" : "shadow-page", isDropTarget && "outline-2 outline-offset-4 outline-mark [outline-style:dashed]",
        view.tool === "frame" && "cursor-tool-frame", view.tool === "text" && "cursor-tool-text", view.tool === "hand" && "cursor-grab", className)}
      style={{ width: SW * sc, height: SH * sc, background: s.bg ?? "var(--paper, #fff)", clipPath: si === 0 ? "inset(-60px -60px -60px 50%)" : undefined }}>
      {parentFrames.map((f) => (
        <FrameEl key={`p-${f.id}`} f={f} si={si} s={s} sc={sc} selected={false} inherited
          onDown={(e) => {
            e.stopPropagation()
            if (ft.overrides && (e.altKey || (e.ctrlKey && e.shiftKey) || (e.metaKey && e.shiftKey))) {
              const copy = { ...f, id: uid(), overrides: f.id }
              st.update((d) => mapSpread(d, si, (sp) => ({ ...sp, frames: [...sp.frames, copy] })), "Override parent item")
              st.setSel([copy.id]); st.setStatus("Local copy created — it no longer follows the parent on this spread")
            } else st.setStatus(ft.overrides ? `Parent item from “${par?.name}” — Alt+click to override on this spread` : `Parent item from “${par?.name}” — edit it on the parent spread`)
          }}
          onDouble={() => { }} editing={false} onEditDone={() => { }} />
      ))}
      {s.frames.map((f) => (
        <FrameEl key={f.id} f={f} si={si} s={s} sc={sc} selected={st.sel.includes(f.id)} onDown={onFrameDown} onDouble={onDouble}
          editing={editing === f.id} onEditDone={(t) => { setEditing(null); if (t !== f.text) st.update((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, text: t, live: x.live && /\{\w+\}/.test(t) })), "Edit text") }} />
      ))}
      {view.preview && <div className="pointer-events-none absolute inset-0 outline-[4000px] outline-canvas [outline-style:solid]" />}
      {view.grid && !view.preview && <GridOverlay s={s} sc={sc} />}
      {view.guides && !view.preview && allGuides(doc, s).map((g) => <GuideLine key={g.id} g={g} sc={sc} onDown={(e) => onGuideDown?.(e, g.id, !!g.inherited)} />)}
      {view.overlays && <PrintOverlay sc={sc} />}
      {pn && !view.preview && [0, 1].map((side) => (si === 0 && doc.skipFirst && side === 0 ? null :
        <span key={side} className="pointer-events-none absolute text-ink" data-testid="page-number"
          style={{ bottom: 7 * sc, [side === 0 ? "left" : "right"]: 12 * sc, fontSize: Math.max(8, 3 * sc), fontFamily: "'Inter Variable', sans-serif" }}>{pageNo(side as 0 | 1)}</span>
      ))}
      {pn && view.preview && [0, 1].map((side) => <span key={side} className="pointer-events-none absolute text-ink" style={{ bottom: 7 * sc, [side === 0 ? "left" : "right"]: 12 * sc, fontSize: Math.max(8, 3 * sc) }}>{pageNo(side as 0 | 1)}</span>)}
      {!view.preview && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />}
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          <div className={cn("pointer-events-none absolute z-50 bg-bleed", l.axis === "v" ? "inset-y-[-10px] w-[1.5px]" : "inset-x-[-10px] h-[1.5px]")} style={l.axis === "v" ? { left: l.pos * sc } : { top: l.pos * sc }} />
          <span className="pointer-events-none absolute z-50 whitespace-nowrap rounded-xs bg-field px-1.5 py-px text-2xs font-semibold text-foreground" style={l.axis === "v" ? { left: l.pos * sc + 4, top: -22 } : { top: l.pos * sc + 3, left: -8, transform: "translateX(-100%)" }} data-testid="snap-line">snap · {l.kind}</span>
        </React.Fragment>
      ))}
      {marquee && <div className="pointer-events-none absolute z-50 bg-select/10 outline-1 outline-mark [outline-style:solid]" style={{ left: marquee.x * sc, top: marquee.y * sc, width: marquee.w * sc, height: marquee.h * sc }} />}
      {showSel && single && ft.handles && !single.locked && <Handles r={single} sc={sc} rotate={!!ft.rotateHandle} onHandle={onHandle} />}
      {showSel && (!ft.handles || selFrames.length > 1 || single?.locked) && selFrames.map((f) => (
        <div key={f.id} data-testid="sel-outline" className="pointer-events-none absolute z-40 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }} />
      ))}
      {showSel && selFrames.length > 1 && (() => { const b = bbox(selFrames); return <div className="pointer-events-none absolute z-40 outline-1 outline-dashed outline-mark" style={{ left: b.x * sc - 4, top: b.y * sc - 4, width: b.w * sc + 8, height: b.h * sc + 8 }}><span className="absolute -top-6 left-0 rounded-md bg-tag px-1.5 py-0.5 text-2xs font-medium text-white">{selFrames.length} frames</span></div> })()}
      {/* proto: floating contextual toolbar for a single selected frame */}
      {active && si === st.cur && <TemplatePreview sc={sc} />}
      {st.cropId && s.frames.some((f) => f.id === st.cropId) && (() => { const f = s.frames.find((x) => x.id === st.cropId)!; return <div data-testid="crop-overlay" className="pointer-events-none absolute z-40 outline-2 outline-crop [outline-style:solid]" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc }}><span className="absolute -top-6 left-0 rounded-md bg-field px-1.5 py-0.5 text-2xs font-semibold text-foreground">Crop · {Math.round(f.zoom * 100)}%</span></div> })()}
    </div>
  )
}
export function bbox(fs: Rect[]): Rect {
  const x = Math.min(...fs.map((f) => f.x)), y = Math.min(...fs.map((f) => f.y))
  return { x, y, w: Math.max(...fs.map((f) => f.x + f.w)) - x, h: Math.max(...fs.map((f) => f.y + f.h)) - y }
}
export { framesFromTemplate }


/* proto-2: hovering a layout thumbnail previews its slots on the current spread */
function TemplatePreview({ sc }: { sc: number }) {
  const id = useTemplatePreview()
  if (!id) return null
  const t = TT(id)
  return (
    <div className="pointer-events-none absolute inset-0 z-40 bg-background/70" data-testid="tpl-preview">
      {t.frames.map((b, i) => <div key={i} className="absolute rounded-2xs bg-select/15 outline-2 -outline-offset-2 outline-dashed outline-mark" style={{ left: b.x * SW / 100 * sc, top: b.y * SH / 100 * sc, width: b.w * SW / 100 * sc, height: b.h * SH / 100 * sc }} />)}
      <div className="absolute left-2 top-2 rounded-md bg-field px-2 py-1 text-xs font-medium text-foreground">Preview · {t.name}</div>
    </div>
  )
}

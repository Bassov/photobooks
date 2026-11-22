/* Sandbox canvas: spread surface with frames, crop, handles, snapping, guides, rulers, grid, print overlays. */
import { FolioMarks, useMasters } from "./v7"
import * as React from "react"
import { useDrop, useDrag, type DropItem } from "react-aria"
import { AlertTriangle, ImagePlus, Lock, Unlink2 } from "lucide-react"
import { TT, useTemplatePreview } from "./templates"
import { cn } from "@/lib/utils"
import { P } from "@/data"
import {
  SW, SH, PAGE, type Doc, type Frame, type Spread, type Rect, type SnapLine, type Anchor, anchors, snapRect, resolveGrid, effectiveGrid,
  allGuides, clamp, round, effectiveDpi, orientedSize, photoOf, uid, framesFromTemplate,
  parentOf, pageNumbersOf, foliosOf, printSafe, type Guide, photoRect, keepPhoto, scalePhoto, panPhoto,
} from "./model"
import { useStudio, mapSpread, mapFrames, placePhoto, useKeys, type Studio } from "./store"
import { countLabel, duplicateFrames } from "./clipboard"
import { anchorPhoto, fillTokens } from "./meta"
import { setTextOverflow, takeTextGrow, useTextOverflow } from "./text-overflow"
import { badgeFit, frameContains, isOverridePress, overrideFrame, parentFramesOf, parentHit } from "./parent-overrides"

export const PHOTO_TYPE = "application/x-photobooks-photo"
export const FRAME_TYPE = "application/x-photobooks-frame"
/** Status when a drag, nudge or Del finds only locked frames to act on. */
export const FRAME_LOCKED_STATUS = "Frame is locked — unlock it in the inspector (Ctrl+Shift+L)"
/** Designer frame-copy-paste FC2: the status while an Alt-press duplicate drag runs. */
export const DUPLICATE_DRAG_STATUS = "Release to place the copy · Esc to cancel"
/** True from an Alt-press on a frame until its gesture ends: the frame's native (swap) drag must not start. */
const altPress = { on: false }

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

/** Designer text-frames: a text box shows whole lines only, floor(h / line) of them; below that it is empty paper. */
const wholeLines = (h: number, line: number) => Math.floor(h / line + 1e-6) * line

function TextView({ f, text, css, vis, line, preview, onGrow }: { f: Frame; text: string; css: React.CSSProperties; vis: number; line: number; preview: boolean; onGrow: (lines: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    let live = true
    // an inspector content edit grows the box to whole lines, like the canvas edit (onGrow caps it at the paper bottom)
    const el = ref.current
    if (el && takeTextGrow(f.id) && el.scrollHeight > vis + 0.5) { onGrow(Math.round(el.scrollHeight / line)); return }
    const measure = () => { const el = ref.current; if (live && el) setTextOverflow(f.id, !!text && el.scrollHeight > vis + 0.5) }
    measure(); void document.fonts?.ready.then(measure)
    return () => { live = false }
  })
  React.useEffect(() => () => setTextOverflow(f.id, false), [f.id])
  return (
    <div ref={ref} data-testid="text-body" className="absolute inset-x-0 top-0 overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ ...css, height: vis }}>
      {text || (!preview && <span className="opacity-40">Empty text</span>)}
    </div>
  )
}

/* Edit mode: transparent textarea at the frame rect, 1 px outline, no handles. A content edit grows the box to whole lines,
   capped at the paper bottom, by DOM style only (no doc render per key); the grown h is written with the text on exit. */
function TextEdit({ f, css, line, sc, onEditDone }: { f: Frame; css: React.CSSProperties; line: number; sc: number; onEditDone?: (t: string, h: number) => void }) {
  const box = React.useRef<HTMLDivElement>(null), ta = React.useRef<HTMLTextAreaElement>(null)
  const lines = React.useRef(0), cur = React.useRef(f.h * sc)
  const t = TEXT[f.textStyle ?? "caption"], lineMm = t.size * t.lh
  React.useLayoutEffect(() => { const el = ta.current!; el.focus(); el.setSelectionRange(el.value.length, el.value.length) }, [])
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "0px"; const content = el.scrollHeight; el.style.height = ""
    if (content <= wholeLines(cur.current, line) + 0.5) return
    lines.current = Math.round(content / line)
    cur.current = Math.min((SH - f.y) * sc, lines.current * line)
    box.current!.style.height = `${cur.current}px`
  }
  const h = () => Math.max(f.h, Math.min(round(SH - f.y, 2), round(lines.current * lineMm, 2)))
  return (
    <div ref={box} className="absolute inset-x-0 top-0 outline-1 outline-offset-1 outline-select [outline-style:solid]" style={{ height: f.h * sc }} data-testid="text-edit">
      <textarea ref={ta} defaultValue={f.text} aria-label="Text" placeholder="Type text" onInput={(e) => grow(e.currentTarget)}
        onBlur={(e) => onEditDone?.(e.currentTarget.value, h())}
        onKeyDown={(e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) (e.currentTarget as HTMLTextAreaElement).blur(); e.stopPropagation() }}
        onPointerDown={(e) => e.stopPropagation()}
        className="block size-full resize-none border-0 bg-transparent p-0 caret-[#232223] outline-hidden selection:bg-sel placeholder:text-[rgb(35_34_32/.4)] [overflow-wrap:anywhere]" style={css} />
    </div>
  )
}

/* ---------------------------------------------------------------- one frame */
function FrameBody({ f, s, sc, missing, inherited, editing, onEditDone }: {
  f: Frame; s: Spread; sc: number; missing: boolean; inherited?: boolean; editing?: boolean; onEditDone?: (t: string, h: number) => void
}) {
  const st = useStudio()
  const style = f.styleId ? st.doc.styles.find((x) => x.id === f.styleId) : undefined
  const mat = (style?.mat ?? 0) * sc
  const wpx = f.w * sc - mat * 2, hpx = f.h * sc - mat * 2
  if (f.kind === "text") {
    const t = TEXT[f.textStyle ?? "caption"]
    const text = f.live ? fillTokens(f.text ?? "", anchorPhoto(s.frames, f)) : f.text ?? ""
    const css: React.CSSProperties = { fontFamily: t.font, fontSize: t.size * sc, fontWeight: t.weight, lineHeight: t.lh, textAlign: f.align ?? "left", color: "#232220" }
    const line = t.size * t.lh * sc
    if (editing) return <TextEdit f={f} css={css} line={line} sc={sc} onEditDone={onEditDone} />
    const onGrow = (n: number) => {
      const h = Math.max(f.h, Math.min(round(SH - f.y, 2), round(n * t.size * t.lh, 2)))
      if (h > f.h) st.update((d) => mapFrames(d, d.spreads.findIndex((x) => x.id === s.id), [f.id], (x) => ({ ...x, h })), "Edit text", `txt-${f.id}`)
    }
    return <TextView f={f} text={text} css={css} vis={wholeLines(f.h * sc, line)} line={line} preview={st.view.preview} onGrow={onGrow} />
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
  editing: boolean; onEditDone: (t: string, h: number) => void
}
/** K1: Esc or a release ends a frame drag even when the browser never sends dragleave / dragend,
 *  so the "Release to replace" chip and the dimmed source clear on cancel (prod M43); a new dragstart re-arms. */
function useDragLive(on: boolean) {
  const [live, setLive] = React.useState(true)
  React.useEffect(() => {
    if (!on) return
    setLive(true)
    const end = (e: Event) => { if (!(e instanceof KeyboardEvent) || e.key === "Escape") setLive(false) }
    const arm = () => setLive(true)
    const evs = ["keydown", "pointerup", "dragend", "drop"]
    evs.forEach((t) => window.addEventListener(t, end, true)); window.addEventListener("dragstart", arm, true)
    return () => { evs.forEach((t) => window.removeEventListener(t, end, true)); window.removeEventListener("dragstart", arm, true) }
  }, [on])
  return on && live
}
/** Designer parent-overrides PO3: the override copy chip, screen px at every zoom; icon-only or none on small frames (fit rule). */
function OverrideBadge({ fit }: { fit: ReturnType<typeof badgeFit> }) {
  if (fit === "none") return null
  const icon = fit === "icon"
  return (
    <span data-testid="override-badge" data-fit={fit} role={icon ? "img" : undefined} aria-label={icon ? "Override" : undefined} title={icon ? "Override" : undefined}
      className="pointer-events-none absolute left-1 top-1 inline-flex h-[16.84px] items-center justify-center gap-1 whitespace-nowrap rounded-xs bg-parent px-1 py-px text-2xs font-semibold leading-[14.85px] text-white">
      <Unlink2 className="size-2.5" />{!icon && "override"}
    </span>
  )
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
  // swap drag only with Select: a native drag would eat the pointerup of a Text press over a photo (Designer text-frames)
  const swap = !!st.features.swap && !!f.photo && !p.inherited && st.view.tool === "select"
  const { dragProps, isDragging } = useDrag({
    isDisabled: !swap,
    getItems: () => [{ [FRAME_TYPE]: `${p.si}:${f.id}`, "text/plain": f.photo ? P(f.photo).name : "" }],
    onDragStart: () => st.setStatus("Drag onto another frame to swap, or onto the filmstrip to take the photo back"),
    onDragEnd: () => st.setStatus(""),
  })
  const dropLive = useDragLive(isDropTarget), dragLive = useDragLive(isDragging)
  const crop = st.cropId === f.id
  const dpi = st.view.dpi && f.kind === "image" ? effectiveDpi(f) : null
  const overflow = useTextOverflow(f.kind === "text" && !p.inherited ? f.id : undefined)
  return (
    <div ref={ref} {...(canDrop ? dropProps : {})} {...(swap ? dragProps : {})}
      data-frame={f.id} data-testid={p.inherited ? "master-frame" : "frame"}
      onPointerDown={(e) => p.onDown(e, f)} onDoubleClick={() => p.onDouble(f)}
      onDragStartCapture={(e) => { if (altPress.on) { e.preventDefault(); e.stopPropagation() } }}
      data-override={f.overrides ? "true" : undefined}
      className={cn("group/frame absolute", p.inherited && "pointer-events-none", dragLive && "opacity-40", p.hidden && "opacity-0",
        // FC2: Alt held (viewport.tsx sets data-alt-duplicate) over an own frame with Select = the duplicate-drag cursor
        !p.inherited && st.view.tool === "select" && st.features.handles && "in-[[data-alt-duplicate]]:cursor-copy")}
      style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined, zIndex: crop || p.editing ? 30 : undefined }}>
      <FrameBody f={f} s={p.s} sc={sc} missing={missing} inherited={p.inherited} editing={p.editing} onEditDone={p.onEditDone} />
      {f.kind === "image" && f.caption && <div data-testid="frame-caption" className="pointer-events-none absolute inset-x-0 truncate" style={{ top: f.h * sc + 1.5 * sc, fontSize: TEXT.caption.size * sc, fontFamily: TEXT.caption.font, color: "#535152", lineHeight: 1.3 }}>{f.caption}</div>}
      {!p.selected && !p.inherited && <div className="pointer-events-none absolute inset-0 outline-1 outline-select/0 transition-[outline-color] group-hover/frame:outline-select/70 [outline-style:solid]" />}
      {p.inherited && !st.view.preview && <div data-allow-border className="pointer-events-none absolute inset-0 outline-1 outline-offset-0 outline-parent-soft [outline-style:dashed]" />}
      {f.overrides && !st.view.preview && !crop && <OverrideBadge fit={badgeFit(f.w * sc, f.h * sc)} />}
      {dropLive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-parent/20 pt-2 outline-2 outline-select [outline-style:solid]">
          <span className="rounded-md bg-field px-2 py-0.5 text-2xs font-medium text-foreground shadow">{f.photo ? "Release to replace" : "Release to place"}</span>
        </div>
      )}
      {st.dragging && canDrop && !dropLive && !f.photo && <div className="pointer-events-none absolute inset-0 bg-parent/10 outline-1 outline-select/60 [outline-style:dashed]" />}
      {f.locked && !st.view.preview && <span className="pointer-events-none absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/55 text-white"><Lock className="size-3" /></span>}
      {dpi !== null && dpi < 300 && !st.view.preview && (
        <span className={cn("pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-xs bg-field px-1.5 py-0.5 text-2xs text-ink-warning shadow-sm", dpi < 150 ? "font-semibold" : "font-medium")} data-testid="dpi-badge">
          <AlertTriangle className="size-2.5" />{dpi} dpi
        </span>
      )}
      {/* Designer text-frames: the Low-res chip look (M85), 4 px under the frame, right-aligned; inside when it would pass the paper bottom */}
      {overflow && !p.editing && !st.view.preview && (
        <span data-testid="text-overflow-chip" title="Text doesn't fit the frame"
          className="pointer-events-none absolute z-10 inline-flex h-3.5 items-center gap-1 whitespace-nowrap rounded-xs bg-field px-1 py-px text-2xs font-medium leading-3 text-ink-warning"
          style={(f.y + f.h) * sc + 18 > SH * sc ? { right: 4, bottom: 4 } : { right: 0, top: f.h * sc + 4 }}>
          <AlertTriangle className="size-2.5" />Overflow
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
    if (frameId) placePhoto(st, si, frameId, photos[0])
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

const HANDLE_PTS: [string, number, number, string][] = [["nw", 0, 0, "nwse-resize"], ["n", 50, 0, "ns-resize"], ["ne", 100, 0, "nesw-resize"], ["w", 0, 50, "ew-resize"], ["e", 100, 50, "ew-resize"], ["sw", 0, 100, "nesw-resize"], ["s", 50, 100, "ns-resize"], ["se", 100, 100, "nwse-resize"]]
const SelOutline = () => <div className="pointer-events-none absolute inset-0 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]" data-testid="sel-outline" />
function FrameHandles({ pts, onHandle }: { pts: typeof HANDLE_PTS; onHandle: (e: React.PointerEvent, h: string) => void }) {
  return pts.map(([h, x, y, c]) => (
    <span key={h} onPointerDown={(e) => onHandle(e, h)} data-handle={h} data-testid="sel-handle"
      className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-2xs bg-white" style={{ left: `${x}%`, top: `${y}%`, cursor: c, boxShadow: "0 0 0 1.5px #232223" }} />
  ))
}
function RotateKnob({ onHandle }: { onHandle: (e: React.PointerEvent, h: string) => void }) {
  return (
    <>
      <span data-testid="rotate-stem" className="pointer-events-none absolute left-1/2 top-[-22px] h-[20px] w-px bg-select" />
      <span onPointerDown={(e) => onHandle(e, "rot")} data-handle="rot" data-testid="rotate-knob" className="pointer-events-auto absolute left-1/2 top-[-28px] size-3 -translate-x-1/2 cursor-grab rounded-full bg-white" style={{ boxShadow: "0 0 0 1.5px #232223" }} />
    </>
  )
}
function Handles({ r, sc, rotate, onHandle }: { r: Rect & { rot?: number }; sc: number; rotate: boolean; onHandle: (e: React.PointerEvent, h: string) => void }) {
  return (
    <div className="pointer-events-none absolute z-40" style={{ left: r.x * sc, top: r.y * sc, width: r.w * sc, height: r.h * sc, transform: r.rot ? `rotate(${r.rot}deg)` : undefined }} data-testid="handles">
      <SelOutline />
      <FrameHandles pts={HANDLE_PTS} onHandle={onHandle} />
      {rotate && <RotateKnob onHandle={onHandle} />}
    </div>
  )
}

/* Designer walkthrough-ux-review §A (direct crop): chrome of a selected single photo frame. Frame handles crop (the photo
   stays on the page), the centre grabber pans, the photo layer (ghost .3 + extent outline + 4 round corner handles) shows
   on grabber / photo-handle hover, during a photo gesture or pinned (double-click / Crop), and hides 400 ms after the
   pointer is > 12 px outside the photo. DOM order = hit order, bottom up: ghost, grabber, rotate knob, frame handles,
   photo handles. Sizes are plain px: the kit draws the spread at `sc`, so they are screen px at every zoom.
   The rotate knob is part of this chrome as in prod (Spec table), whatever `features.rotateHandle` says. */
export type Corner = "nw" | "ne" | "sw" | "se"
const CORNERS: [Corner, number, number, string][] = [["nw", 0, 0, "nwse-resize"], ["ne", 1, 0, "nesw-resize"], ["sw", 0, 1, "nesw-resize"], ["se", 1, 1, "nwse-resize"]]
const ENTER = "animate-in fade-in duration-(--duration-fast) ease-out motion-reduce:animate-none"
function FrameChrome({ f, sc, pinned, rotate, op, rotating, onHandle, onPan, onScale, onPin }: {
  f: Frame; sc: number; pinned: boolean; rotate: boolean; op: Corner | "pan" | null; rotating: boolean
  onHandle: (e: React.PointerEvent, h: string) => void; onPan: (e: React.PointerEvent) => void; onScale: (e: React.PointerEvent, c: Corner) => void
  /** double-click on the grabber or the ghost pins the layer, as on the frame */
  onPin: () => void
}) {
  const [hover, setHover] = React.useState(false)
  const ext = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!hover) return
    let t: number | undefined
    const mv = (e: PointerEvent) => {
      const b = ext.current?.getBoundingClientRect(); if (!b) return
      const d = Math.hypot(Math.max(b.left - e.clientX, 0, e.clientX - b.right), Math.max(b.top - e.clientY, 0, e.clientY - b.bottom))
      if (d <= 12) { window.clearTimeout(t); t = undefined } else if (t === undefined) t = window.setTimeout(() => setHover(false), 400)
    }
    window.addEventListener("pointermove", mv)
    return () => { window.removeEventListener("pointermove", mv); window.clearTimeout(t) }
  }, [hover])
  const img = photoRect(f)!, wpx = f.w * sc, hpx = f.h * sc
  const ix = (img.x - f.x) * sc, iy = (img.y - f.y) * sc, iw = img.w * sc, ih = img.h * sc
  // the visible photo's centre, ≥ 20 px inside the frame edges
  const gx = clamp((Math.max(0, ix) + Math.min(wpx, ix + iw)) / 2, 20, wpx - 20), gy = clamp((Math.max(0, iy) + Math.min(hpx, iy + ih)) / 2, 20, hpx - 20)
  const shown = pinned || hover || !!op, frameKeys = !pinned && !op
  // a side < 40 px hides its mid handles (corners stay)
  const pts = HANDLE_PTS.filter(([h]) => !((h === "n" || h === "s") && wpx < 40) && !((h === "w" || h === "e") && hpx < 40))
  const show = () => setHover(true)
  return (
    <div className="pointer-events-none absolute z-40" style={{ left: f.x * sc, top: f.y * sc, width: wpx, height: hpx, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }} data-testid="handles" data-pinned={pinned || undefined}>
      {shown && (
        <div data-testid="photo-layer" className={ENTER}>
          <div className="absolute inset-0"><PhotoImg f={f} wpx={wpx} hpx={hpx} ghost /></div>
          <div ref={ext} data-testid="photo-ghost" onPointerDown={onPan} onDoubleClick={onPin} className="pointer-events-auto absolute cursor-move"
            style={{ left: ix, top: iy, width: iw, height: ih, boxShadow: "0 0 0 1px rgb(255 255 255 / .9), 0 0 0 2px rgb(0 0 0 / .28)" }} />
        </div>
      )}
      {!pinned && <SelOutline />}
      {wpx >= 64 && hpx >= 64 && (
        <span data-testid="crop-grabber" title="Drag to move the photo" onPointerEnter={show} onPointerDown={onPan} onDoubleClick={onPin}
          className="pointer-events-auto absolute size-7 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full bg-[rgb(255_255_255/.72)] transition-[background-color,scale] duration-(--duration-fast) ease-out hover:scale-110 hover:bg-white motion-reduce:transition-none"
          style={{ left: gx, top: gy, boxShadow: "0 0 0 1.5px var(--select), 0 1px 3px rgb(0 0 0 / .25)" }}>
          <span className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-select" />
        </span>
      )}
      {rotate && frameKeys && <RotateKnob onHandle={onHandle} />}
      {rotating && <span data-testid="rotate-chip" className="absolute whitespace-nowrap rounded-md bg-field px-1.5 text-2xs font-semibold leading-4 text-foreground" style={{ left: wpx / 2 + 16, top: -30 }}>{Math.round(f.rot)}°</span>}
      {frameKeys && <FrameHandles pts={pts} onHandle={onHandle} />}
      {shown && CORNERS.map(([c, x, y, cur]) => {
        const on = op === c
        return (
          <span key={c} role="button" tabIndex={0} aria-label={`Scale photo from ${c}`} data-testid="photo-handle" data-corner={c} data-active={on || undefined}
            onPointerEnter={show} onPointerDown={(e) => onScale(e, c)}
            className={cn("pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A3839] focus-visible:[outline-style:solid]", ENTER)}
            style={{ left: ix + x * iw, top: iy + y * ih, cursor: cur, background: on ? "var(--crop)" : "var(--paper)",
              boxShadow: on ? "0 0 0 1.5px var(--paper), 0 0 0 3px var(--crop)" : "0 0 0 1.5px var(--crop), 0 1px 2px rgb(0 0 0 / .25)" }} />
        )
      })}
      {op && !pinned && <span data-testid="crop-tag" className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-field px-1.5 py-0.5 text-2xs font-semibold leading-4 text-foreground">Crop · {Math.round(f.zoom * 100)}%</span>}
    </div>
  )
}

/* ---------------------------------------------------------------- spread surface */
/** One guide line with its 7 px grab strip, 24 px past the page; `inherited` guides come from the parent master (dashed);
 *  `passive` ones (inherited, outside parent edit) let presses through to the frame / paper below (parent-guides PG2). */
export function GuideLine({ g, sc, passive, onDown }: { g: Guide & { inherited?: boolean }; sc: number; passive?: boolean; onDown: (e: React.PointerEvent) => void }) {
  return (
    <div data-guide={g.id} data-passive={passive || undefined} onPointerDown={passive ? undefined : onDown}
      className={cn("absolute z-20", g.axis === "v" ? "inset-y-[-24px] w-[7px] -translate-x-[3px] cursor-ew-resize" : "inset-x-[-24px] h-[7px] -translate-y-[3px] cursor-ns-resize", (g.locked || g.inherited) && "cursor-default", passive && "pointer-events-none")}
      style={g.axis === "v" ? { left: g.pos * sc } : { top: g.pos * sc }}>
      <div className={cn("absolute", g.axis === "v" ? "inset-y-0 left-[3px] w-px" : "inset-x-0 top-[3px] h-px", g.inherited ? "bg-parent-soft [background:repeating-linear-gradient(var(--dir),var(--parent-soft)_0_4px,transparent_4px_7px)]" : g.scope === "book" ? "bg-portrait" : "bg-guide")}
        style={{ ["--dir" as string]: g.axis === "v" ? "180deg" : "90deg" }} />
    </div>
  )
}
export function SpreadSurface({ si, sc, active = true, onGuideDown, className }: {
  si: number; sc: number; active?: boolean; className?: string
  onGuideDown?: (e: React.PointerEvent, id: string) => void
}) {
  const st = useStudio()
  const { doc, features: ft, view } = st
  const s = doc.spreads[si]
  const ref = React.useRef<HTMLDivElement>(null)
  const [lines, setLines] = React.useState<SnapLine[]>([])
  const [marquee, setMarquee] = React.useState<Rect | null>(null)
  /** FC2: the Alt-press duplicate drag in progress — its frames and the clones' delta (mm) */
  const [dup, setDup] = React.useState<{ ids: string[]; x: number; y: number } | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const fresh = React.useRef<string | null>(null)
  const par = parentOf(doc, s)
  const parentFrames = parentFramesOf(doc, s)
  const selFrames = s.frames.filter((f) => st.sel.includes(f.id))

  const pt = (e: { clientX: number; clientY: number }) => {
    const b = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - b.left) / sc, y: (e.clientY - b.top) / sc }
  }
  const th = 6 / sc
  const gesture = (e: React.PointerEvent, onMove: (p: { x: number; y: number }, ev: PointerEvent) => void, onUp: (moved: boolean) => void, onCancel?: () => void) => {
    const start = pt(e); let moved = false
    const off = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key, true); window.removeEventListener("pointercancel", lost) }
    const mv = (ev: PointerEvent) => { if (!ref.current) { off(); return } const p = pt(ev); if (!moved && Math.hypot(p.x - start.x, p.y - start.y) * sc < 3) return; moved = true; onMove(p, ev) }
    const up = () => { off(); setLines([]); onUp(moved) }
    // with onCancel, Esc during the press (or a lost pointer) ends the gesture without onUp
    const lost = () => { off(); setLines([]); onCancel!() }
    const key = (ev: KeyboardEvent) => { if (ev.key !== "Escape") return; ev.stopPropagation(); lost() }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
    if (onCancel) { window.addEventListener("keydown", key, true); window.addEventListener("pointercancel", lost) }
    return start
  }
  const snapOn = view.snap
  const anc = (exclude: string[]) => anchors(doc, s, { grid: view.snapGrid && (view.grid || ft.handles === true), guides: view.snapGuides && view.guides, frames: view.snapFrames, exclude })

  const onFrameDown = (e: React.PointerEvent, f: Frame) => {
    if (e.button !== 0) return
    if (st.cropId && st.cropId !== f.id) st.setCropId(null)
    if (editing === f.id) return
    st.setCur(si)
    // Designer text-frames: Text over a photo frame starts a text frame (captions on photos); over a text frame it edits that one
    if (view.tool === "text" && st.cropId !== f.id) {
      e.stopPropagation()
      if (f.kind !== "text") { drawFrame(e, "text"); return }
      e.preventDefault(); st.setSel([f.id]); st.setView({ tool: "select" }); setEditing(f.id); return
    }
    if (st.cropId === f.id) { panFrom(e, f); return } // pan inside the frame
    e.stopPropagation()
    let sel = st.sel
    if (e.shiftKey && ft.multi) sel = sel.includes(f.id) ? sel.filter((x) => x !== f.id) : [...sel, f.id]
    else if (!sel.includes(f.id)) sel = [f.id]
    st.setSel(sel)
    // v0.7.3 (P2): a plain click (no drag) on one frame of a multi-selection collapses to that frame, so its toolbar (Crop) shows up
    const collapse = !e.shiftKey && sel.length > 1 && sel.includes(f.id)
    if (!ft.handles || view.tool !== "select") { if (collapse) st.setSel([f.id]); return }
    // FC2 (D2): Alt held at the press duplicates the selection (any lock state) instead of moving it
    if (e.altKey) { moveFrames(e, s.frames.filter((x) => sel.includes(x.id)), () => { if (collapse) st.setSel([f.id]) }, true); return }
    const moving = s.frames.filter((x) => sel.includes(x.id) && !x.locked)
    if (!moving.length) { if (collapse) st.setSel([f.id]); if (f.locked) st.setStatus(FRAME_LOCKED_STATUS); return }
    moveFrames(e, moving, () => { if (collapse) st.setSel([f.id]) })
  }
  /** Move gesture after the 3 px slop: one "Move frame(s)" step on release; `onClick` when the press never moved; Esc /
   *  lost pointer = frames back where they started, no step.
   *  `dup` (FC2 Alt-press): clones follow the pointer, the originals stay; release = one "Duplicate frame(s)" step, Esc / lost
   *  pointer = nothing. The Alt that started it does not bypass snapping (`altLatch` until a move without Alt). */
  const moveFrames = (e: React.PointerEvent, moving: Frame[], onClick: () => void, dup = false) => {
    const orig = moving.map((x) => ({ id: x.id, x: x.x, y: x.y }))
    const bb = bbox(moving)
    const A = anc(dup ? [] : moving.map((x) => x.id)) // the originals stay put: a copy may snap to them
    const GA = view.grid && view.snapGrid ? (() => { const a = anchors(doc, s, { grid: true, guides: false, frames: false, exclude: [] }); const k = (x: Anchor) => /^(column|row) /.test(x.kind); return { xs: a.xs.filter(k), ys: a.ys.filter(k) } })() : null
    let altLatch = dup, delta = { x: 0, y: 0 }, shown = false
    altPress.on = dup
    const end = () => { altPress.on = false; setDup(null); if (shown) st.setStatus("") }
    const start = gesture(e, (p, ev) => {
      let dx = p.x - start.x, dy = p.y - start.y
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
      let ls: SnapLine[] = []
      if (!ev.altKey) altLatch = false
      if (snapOn && !(ev.altKey && !altLatch)) {
        // v0.8.1 (P2-9): with the layout grid visible, column / row edges win within a wider 16px pull, per axis
        const R = { ...bb, x: bb.x + dx, y: bb.y + dy }, r = snapRect(R, A, th)
        const g = GA ? snapRect(R, GA, 16 / sc, { x: ["l", "r"], y: ["t", "b"] }) : null
        const gx = g?.lines.find((l) => l.axis === "v"), gy = g?.lines.find((l) => l.axis === "h")
        dx += gx ? g!.dx : r.dx; dy += gy ? g!.dy : r.dy
        ls = [gx ?? r.lines.find((l) => l.axis === "v"), gy ?? r.lines.find((l) => l.axis === "h")].filter(Boolean) as SnapLine[]
        if ((gx || gy) && !dup) st.setStatus(`Snapped to ${[gx?.kind, gy?.kind].filter(Boolean).join(" · ")}`)
      }
      setLines(ls)
      if (dup) {
        if (!shown) { shown = true; st.setStatus(DUPLICATE_DRAG_STATUS) }
        delta = { x: round(dx, 2), y: round(dy, 2) }
        setDup({ ids: orig.map((o) => o.id), ...delta })
        return
      }
      st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: sp.frames.map((x) => { const o = orig.find((q) => q.id === x.id); return o ? { ...x, x: round(o.x + dx, 2), y: round(o.y + dy, 2) } : x }) })))
    }, (m) => {
      if (dup) {
        end()
        if (!m) { onClick(); return }
        // one step; the copies become the selection and the step memory (D8: a Ctrl+D next repeats this delta)
        const out = duplicateFrames(doc, si, orig.map((o) => o.id), delta)
        st.update(() => out.doc, countLabel("Duplicate", out.ids.length))
        st.setCropId(null)
        st.setSel(out.ids)
        return
      }
      if (m) { st.commit(moving.length > 1 ? `Move ${moving.length} frames` : "Move frame"); st.setStatus("") } else onClick()
    }, () => {
      // Esc / lost pointer (as prod frameGesture): the frames go back, the release does nothing, no step, selection kept
      end()
      if (dup) return
      st.cancelPreview(); st.setStatus("")
    })
  }
  /* Designer parent-overrides PO2 (+ parent-overrides-canvas review 3): Ctrl/⌘+Shift press, geometric and through own frames —
     a parent guide (viewport.tsx copies it and drags), else the topmost override copy (selected, no step; moves after 3 px),
     else the topmost parent frame ("Override parent item": the copy is selected and the press moves it). */
  const onOverridePress = (e: React.PointerEvent) => {
    if (e.button !== 0 || !ft.overrides || view.tool !== "select" || view.preview || !isOverridePress(e)) return
    // guides only where they can be dragged (the rulers' single-spread camera passes onGuideDown; the stack does not)
    const hit = parentHit(doc, s, pt(e), sc, onGuideDown && view.guides ? allGuides(doc, s).filter((g) => g.inherited) : [])
    if (!hit) return
    e.stopPropagation() // no preventDefault: the press still focuses the canvas, as a plain frame press does
    st.setCur(si)
    if (st.cropId) st.setCropId(null)
    if (hit.kind === "guide") { onGuideDown?.(e, hit.guide.id); return }
    const f = hit.kind === "parent" ? { ...hit.frame, id: uid(), overrides: hit.frame.id } : hit.frame
    if (hit.kind === "parent") {
      st.update((d) => mapSpread(d, si, (sp) => overrideFrame(sp, hit.frame, f.id)), "Override parent item")
      st.setStatus("Local copy created — it no longer follows the parent on this spread")
    }
    st.setSel([f.id])
    if (ft.handles && !f.locked) moveFrames(e, [f], () => { })
  }
  // Plain press on the paper over an uncovered parent item: it stays click-through, the status names it (PO2)
  const parentAt = (e: React.PointerEvent) => parentFrames.filter((f) => frameContains(f, pt(e))).at(-1)
  /* Direct crop (Designer walkthrough-ux-review §A) on a single unlocked photo frame: photo gestures are one step each */
  // Select tool only: a Text / Frame press over the photo draws (Designer text-frames), as before
  const direct = (f: Frame) => !!ft.crop && view.tool === "select" && f.kind === "image" && !!f.photo && !st.missing.has(f.photo) && !f.locked
  const [photoOp, setPhotoOp] = React.useState<{ id: string; op: Corner | "pan" } | null>(null)
  const [rotating, setRotating] = React.useState(false)
  const photoGesture = (e: React.PointerEvent, f: Frame, op: Corner | "pan", move: (p: { x: number; y: number }, from: { x: number; y: number }, ev: PointerEvent) => Partial<Frame>, label: string) => {
    if (e.button !== 0) return
    e.stopPropagation(); st.setCur(si); setPhotoOp({ id: f.id, op })
    const from = gesture(e, (p, ev) => st.preview((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, ...move(p, from, ev) }))),
      (m) => { setPhotoOp(null); if (m) st.commit(label) }, () => { setPhotoOp(null); st.cancelPreview() })
  }
  const panFrom = (e: React.PointerEvent, f: Frame) => photoGesture(e, f, "pan", (p, from) => panPhoto(f, p.x - from.x, p.y - from.y), "Pan photo")
  // corner drag: aspect locked about the opposite corner (Alt: the centre); the scale is the drag projected on the diagonal
  const scaleFrom = (e: React.PointerEvent, f: Frame, c: Corner) => {
    const img = photoRect(f)!
    const cx = c.includes("w") ? img.x : img.x + img.w, cy = c.includes("n") ? img.y : img.y + img.h
    photoGesture(e, f, c, (p, from, ev) => {
      const o = ev.altKey ? { x: img.x + img.w / 2, y: img.y + img.h / 2 } : { x: 2 * img.x + img.w - cx, y: 2 * img.y + img.h - cy }
      const vx = cx - o.x, vy = cy - o.y, qx = vx + p.x - from.x, qy = vy + p.y - from.y
      return scalePhoto(f, (qx * vx + qy * vy) / (vx * vx + vy * vy), o)
    }, "Scale photo")
  }
  const onHandle = (e: React.PointerEvent, h: string) => {
    e.stopPropagation()
    const f = selFrames[0]; if (!f || f.locked) return
    const o = { x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot }
    const A = anc([f.id])
    if (h === "rot") {
      const c = { x: f.x + f.w / 2, y: f.y + f.h / 2 }
      setRotating(true)
      gesture(e, (p, ev) => {
        let ang = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI + 90
        if (ang > 180) ang -= 360
        // Shift: 15° steps; else a snap to 0 / 90 / 180 / 270 within ±2°
        const q = Math.round(ang / 90) * 90
        ang = ev.shiftKey ? Math.round(ang / 15) * 15 : Math.abs(ang - q) <= 2 ? q : round(ang)
        st.preview((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, rot: ang })))
      }, (m) => { setRotating(false); if (m) st.commit("Rotate frame") }, () => { setRotating(false); st.cancelPreview() })
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
      // Shift on a side handle keeps the frame aspect about the frame's centre line
      if (ev.shiftKey && h.length === 1) { const r = o.w / o.h; if (h === "n" || h === "s") { w = hh * r; x = o.x + (o.w - w) / 2 } else { hh = w / r; y = o.y + (o.h - hh) / 2 } }
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
      const r = { x: round(x, 2), y: round(y, 2), w: round(w, 2), h: round(hh, 2) }
      // direct crop: the photo keeps its page rect; Fill scales it about the fixed edge point only when it would stop covering
      const crop = direct(f) ? keepPhoto(f, r, { x: h.includes("e") ? r.x : h.includes("w") ? r.x + r.w : r.x + r.w / 2, y: h.includes("s") ? r.y : h.includes("n") ? r.y + r.h : r.y + r.h / 2 }) : {}
      st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: sp.frames.map((q) => (q.id === f.id ? { ...q, ...r, ...crop } : q)) })))
    }, (m) => m && st.commit(direct(f) ? "Crop frame" : "Resize frame"))
  }
  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    st.setCur(si)
    if (st.cropId) { st.setCropId(null); return }
    if (view.tool === "frame" || view.tool === "text") { drawFrame(e, view.tool); return }
    if (ft.overrides && view.tool === "select" && parentAt(e)) st.setStatus(`Parent item from “${par?.name}”. Ctrl+Shift+click to override it on this spread.`)
    startMarquee(e)
  }
  /* Frame / Text draw. Text (Designer text-frames): a drag keeps min 10 × 4.5 mm (one caption line); a click makes 60 × 14 mm
     (3 caption lines) at the snapped point, inside the clicked page's 6 mm safe area. The new text frame stays a draft and
     editing starts at once: its first edit ends in one "Add text" step, or removes it with no step when left empty (endEdit). */
  const drawFrame = (e: React.PointerEvent, kind: "frame" | "text") => {
    const id = uid(), text = kind === "text"
    const put = (r: Rect) => st.preview((d) => mapSpread(d, si, (sp) => ({ ...sp, template: null, frames: [...sp.frames.filter((q) => q.id !== id), { id, kind: text ? "text" : "image", photo: null, zoom: 1, ox: 0, oy: 0, rot: 0, qt: 0, straighten: 0, text: text ? "" : undefined, textStyle: "caption", align: text ? "left" : undefined, ...r }] })))
    const start = gesture(e, (p) => {
      const r = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
      put(text ? { ...r, w: Math.max(10, r.w), h: Math.max(4.5, r.h) } : r)
    }, (m) => {
      if (!text) { if (m) { st.commit("Add frame"); st.setSel([id]); st.setView({ tool: "select" }) } return }
      if (!m) {
        const x0 = start.x < PAGE ? 0 : PAGE, w = Math.min(60, PAGE - 12), h = 14
        const sn = snapOn ? snapRect({ x: start.x, y: start.y, w: 0, h: 0 }, anc([]), th, { x: ["l"], y: ["t"] }) : { dx: 0, dy: 0 }
        put({ x: round(clamp(start.x + sn.dx, x0 + 6, x0 + PAGE - 6 - w), 2), y: round(clamp(start.y + sn.dy, 6, SH - 6 - h), 2), w, h })
      }
      fresh.current = id; st.setSel([id]); st.setView({ tool: "select" }); setEditing(id)
    }, st.cancelPreview) // Esc during the draw: no frame, no step
  }
  const endEdit = (f: Frame, t: string, h: number) => {
    setEditing(null)
    const patch = (d: Doc) => mapFrames(d, si, [f.id], (x) => ({ ...x, text: t, h }))
    if (fresh.current === f.id) {
      fresh.current = null
      if (!t) { st.cancelPreview(); st.setSel([]); return }
      st.preview(patch); st.commit("Add text"); return
    }
    if (t !== f.text || h !== f.h) st.update(patch, "Edit text")
  }
  /* Marquee (paper or, via viewport.tsx, the pasteboard): hits = own frames whose rotated AABB it touches,
     outlined live; release selects them (∪ the previous set with Shift at the press); Esc restores it. */
  const hitsOf = (m: Rect) => s.frames.filter((f) => { const b = aabb(f); return b.x <= m.x + m.w && b.x + b.w >= m.x && b.y <= m.y + m.h && b.y + b.h >= m.y }).map((f) => f.id)
  const startMarquee = (e: { clientX: number; clientY: number; shiftKey: boolean }) => {
    const prev = st.sel, keep = e.shiftKey ? prev : []
    if (!e.shiftKey) st.setSel([])
    if (!ft.marquee) return
    const start = pt(e); let box: Rect | null = null
    const end = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key, true); setMarquee(null) }
    const mv = (ev: PointerEvent) => {
      const p = pt(ev)
      if (!box && Math.hypot(p.x - start.x, p.y - start.y) * sc < 3) return
      box = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
      setMarquee(box)
    }
    const up = () => { end(); if (box) st.setSel([...new Set([...keep, ...hitsOf(box)])]) }
    const key = (ev: KeyboardEvent) => { if (ev.key !== "Escape") return; ev.stopPropagation(); end(); if (box) st.setSel(prev) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("keydown", key, true)
  }
  /* r16 M92 (Designer #421, prod pasteboardClickSpreadId): the press activates this spread (list row + inspector follow)
     and keeps the scroll; it stops here so the shell's empty-canvas handler does not clear the node again. */
  const onGrayDown = React.useRef((_: GrayPress) => { })
  onGrayDown.current = (e) => {
    if (view.tool !== "select" || view.preview) return
    e.stopPropagation()
    grayPick.si = si
    st.setCur(si)
    if (st.cropId) { st.setCropId(null); return }
    startMarquee(e)
  }
  React.useEffect(() => {
    const start = (e: GrayPress) => onGrayDown.current(e)
    marqueeStarters.set(si, start)
    return () => { if (marqueeStarters.get(si) === start) marqueeStarters.delete(si) }
  }, [si])
  const live = marquee ? hitsOf(marquee).filter((id) => !st.sel.includes(id)) : []
  const onDouble = (f: Frame) => {
    if (f.kind === "text" && ft.textEdit) { setEditing(f.id); return }
    if (f.kind === "image" && f.photo && ft.crop) { st.setCropId(f.id); st.setSel([f.id]); st.setStatus("Crop: drag to move the photo, corners or wheel to zoom, Tab + arrows to nudge, Esc to finish") }
  }
  // Pinned crop: Tab cycles the 4 photo handles, arrows nudge the photo 1 screen px (Shift 10) in one coalesced step
  const pinned = st.cropId ? s.frames.find((x) => x.id === st.cropId && direct(x)) : undefined
  useKeys((e) => {
    if (!pinned) return
    if (e.key === "Tab") {
      const hs = [...(ref.current?.querySelectorAll<HTMLElement>('[data-testid="photo-handle"]') ?? [])]
      if (!hs.length) return
      e.preventDefault()
      const i = hs.indexOf(document.activeElement as HTMLElement), n = hs.length
      hs[i < 0 ? (e.shiftKey ? n - 1 : 0) : (i + (e.shiftKey ? n - 1 : 1)) % n].focus()
      return
    }
    const a = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number] | undefined>)[e.key]
    if (!a || e.metaKey || e.ctrlKey || e.altKey) return
    e.preventDefault()
    const k = (e.shiftKey ? 10 : 1) / sc
    st.update((d) => mapFrames(d, si, [pinned.id], (x) => ({ ...x, ...panPhoto(x, a[0] * k, a[1] * k) })), "Nudge photo", "nudge-crop")
  }, [pinned?.id, sc, si, st])
  // Designer text-frames: Enter on one selected text frame (Select tool) edits it, caret at the end (TextEdit's mount)
  const enterText = active && si === st.cur && view.tool === "select" && !editing && st.sel.length === 1 && ft.textEdit
    ? s.frames.find((f) => f.id === st.sel[0] && f.kind === "text") : undefined
  useKeys((e) => {
    if (!enterText || e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
    if ((e.target as HTMLElement).closest?.("button, a, select, [role=button], [role=menuitem], [role=option], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=slider], [role=combobox], [role=gridcell]")) return
    e.preventDefault(); setEditing(enterText.id)
  }, [enterText?.id])
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
  // FC2: while a duplicate drag runs the originals show no ring or handles; the clones carry it
  const showSel = active && selFrames.length > 0 && !st.cropId && !view.preview && !dup
  const single = selFrames.length === 1 ? selFrames[0] : null
  const chromeF = pinned ?? (showSel && single && ft.handles && editing !== single.id && direct(single) ? single : undefined)
  const folios = view.pageNumbers || pageNumbersOf(par) ? foliosOf(doc, s, si, printSafe(doc, st.book)) : []
  return (
    <div ref={ref} {...dropProps} onPointerDownCapture={onOverridePress} onPointerDown={onBgDown} onWheel={onWheel} data-testid="spread" data-spread={si} data-current={si === st.cur || undefined}
      className={cn("relative shrink-0 select-none", view.preview ? "" : "shadow-page", isDropTarget && "outline-2 outline-offset-4 outline-mark [outline-style:dashed]",
        view.tool === "frame" && "cursor-tool-frame", view.tool === "text" && "cursor-tool-text", view.tool === "hand" && "cursor-grab", className)}
      style={{ width: SW * sc, height: SH * sc, background: s.bg ?? "var(--paper, #fff)", clipPath: si === 0 ? "inset(-60px -60px -60px 50%)" : undefined }}>
      {parentFrames.map((f) => (
        <FrameEl key={`p-${f.id}`} f={f} si={si} s={s} sc={sc} selected={false} inherited
          onDown={() => { }} onDouble={() => { }} editing={false} onEditDone={() => { }} />
      ))}
      {/* Designer page-numbers: the folio is printed parent content, under the spread's own frames (a full-bleed photo hides it) */}
      <FolioMarks folios={folios} sc={sc} />
      {/* parent-overrides PO3: a copy keeps the parent paint slot — after the parent items, before every own frame */}
      {[...s.frames.filter((f) => f.overrides), ...s.frames.filter((f) => !f.overrides)].map((f) => (
        <FrameEl key={f.id} f={f} si={si} s={s} sc={sc} selected={st.sel.includes(f.id)} onDown={onFrameDown} onDouble={onDouble}
          editing={editing === f.id} onEditDone={(t, h) => endEdit(f, t, h)} />
      ))}
      {dup && s.frames.filter((f) => dup.ids.includes(f.id)).map((f) => (
        <div key={f.id} data-testid="dup-clone" className="pointer-events-none absolute z-40"
          style={{ left: (f.x + dup.x) * sc, top: (f.y + dup.y) * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined, opacity: 0.85, boxShadow: "0 0 0 2px var(--select)" }}>
          <FrameBody f={f} s={s} sc={sc} missing={!!f.photo && st.missing.has(f.photo)} />
        </div>
      ))}
      {view.preview && <div className="pointer-events-none absolute inset-0 outline-[4000px] outline-canvas [outline-style:solid]" />}
      {view.grid && !view.preview && <GridOverlay s={s} sc={sc} />}
      {view.guides && !view.preview && allGuides(doc, s).map((g) => <GuideLine key={g.id} g={g} sc={sc} passive={!!g.inherited && !ft.parentEdit} onDown={(e) => onGuideDown?.(e, g.id)} />)}
      {view.overlays && <PrintOverlay sc={sc} />}
      {!view.preview && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />}
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          <div className={cn("pointer-events-none absolute z-50 bg-bleed", l.axis === "v" ? "inset-y-[-10px] w-[1.5px]" : "inset-x-[-10px] h-[1.5px]")} style={l.axis === "v" ? { left: l.pos * sc } : { top: l.pos * sc }} />
          <span className="pointer-events-none absolute z-50 whitespace-nowrap rounded-xs bg-field px-1.5 py-px text-2xs font-semibold text-foreground" style={l.axis === "v" ? { left: l.pos * sc + 4, top: -22 } : { top: l.pos * sc + 3, left: -8, transform: "translateX(-100%)" }} data-testid="snap-line">snap · {l.kind}</span>
        </React.Fragment>
      ))}
      {marquee && <div data-testid="marquee" className="pointer-events-none absolute z-50 bg-select/10 outline-1 outline-mark [outline-style:solid]" style={{ left: marquee.x * sc, top: marquee.y * sc, width: marquee.w * sc, height: marquee.h * sc }} />}
      {s.frames.filter((f) => live.includes(f.id)).map((f) => (
        <div key={f.id} data-testid="marquee-hit" className="pointer-events-none absolute z-40 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }} />
      ))}
      {showSel && single && ft.handles && !single.locked && editing !== single.id && !direct(single) && <Handles r={single} sc={sc} rotate={!!ft.rotateHandle} onHandle={onHandle} />}
      {chromeF && <FrameChrome key={chromeF.id} f={chromeF} sc={sc} pinned={chromeF === pinned} rotate op={photoOp?.id === chromeF.id ? photoOp.op : null} rotating={rotating}
        onHandle={onHandle} onPan={(e) => panFrom(e, chromeF)} onScale={(e, c) => scaleFrom(e, chromeF, c)} onPin={() => onDouble(chromeF)} />}
      {showSel && (!ft.handles || selFrames.length > 1 || single?.locked) && selFrames.filter((f) => f.id !== editing).map((f) => (
        <div key={f.id} data-testid="sel-outline" className="pointer-events-none absolute z-40 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }} />
      ))}
      {showSel && selFrames.length > 1 && (() => { const b = bbox(selFrames); return <div className="pointer-events-none absolute z-40 outline-1 outline-dashed outline-mark" style={{ left: b.x * sc - 4, top: b.y * sc - 4, width: b.w * sc + 8, height: b.h * sc + 8 }} /> })()}
      {/* proto: floating contextual toolbar for a single selected frame */}
      {active && si === st.cur && <TemplatePreview sc={sc} />}
      {st.cropId && s.frames.some((f) => f.id === st.cropId) && (() => { const f = s.frames.find((x) => x.id === st.cropId)!; return <div data-testid="crop-overlay" className="pointer-events-none absolute z-40 outline-2 outline-crop [outline-style:solid]" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc }}><span data-testid="crop-tag" className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-field px-1.5 py-0.5 text-2xs font-semibold leading-4 text-foreground">Crop · {Math.round(f.zoom * 100)}%</span></div> })()}
      {/* Designer frame-context-menu M3: the pick target's tag, in the crop-tag look */}
      {st.pick?.si === si && !view.preview && (() => { const f = s.frames.find((x) => x.id === st.pick!.id); return f && <div data-testid="pick-overlay" className="pointer-events-none absolute z-40" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }}><span data-testid="pick-tag" className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-field px-1.5 py-0.5 text-2xs font-semibold leading-4 text-foreground">{st.pick!.kind === "replace" ? "Replacing" : "Placing"}</span></div> })()}
    </div>
  )
}
/** Axis-aligned box of a frame as painted, rotated corners included (prod snapIndex `paintedBox`). */
export function aabb(f: Rect & { rot?: number }): Rect {
  const t = (f.rot ?? 0) * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t))
  const w = f.w * c + f.h * s, h = f.w * s + f.h * c
  return { x: f.x + (f.w - w) / 2, y: f.y + (f.h - h) / 2, w, h }
}
/** Pasteboard-started marquees (viewport.tsx): spread index → its SpreadSurface starter. */
type GrayPress = { clientX: number; clientY: number; shiftKey: boolean; stopPropagation: () => void }
export const marqueeStarters = new Map<number, (e: GrayPress) => void>()
/** The spread a grey press just activated: the Stack keeps its scroll for it instead of centring it (viewport.tsx). */
export const grayPick = { si: -1 }
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

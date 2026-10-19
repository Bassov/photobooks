/* M3 Building a real book */
import * as React from "react"
import { History, Undo2, Redo2, ImageOff, ArrowRight, RefreshCw, Presentation, X, ChevronLeft, ChevronRight, PanelLeftOpen, PanelRightOpen, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/uui/Badge"
import { Tabs, TabList, Tab } from "@/components/ui/tabs"
import { NumberField, NumberFieldInput } from "@/components/ui/numberfield"
import { FieldGroup } from "@/components/ui/field"
import { IconButton } from "@/components/app/ui"
import { P } from "@/data"
import { useStudio, placedSet } from "@/sandbox/store"
import { makeDoc } from "@/sandbox/model"
import { TopBar, SpreadsPanel, Dock, Filmstrip, TemplateThumb, ConfirmDialog, PanelHeader, SliderMini, MiniSpread, applyTemplate, StatusLine, Pager, Toasts } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, GeometrySection, CropSection, EmptyInspector, useSelected } from "@/sandbox/inspector"
import { Viewport } from "@/sandbox/viewport"
import { StudioProvider } from "@/sandbox/store"
import { ALL_TEMPLATES, slotClasses, bestTemplate, contactSheet } from "@/sandbox/templates"
import { Std } from "./parts"
import type { FeatureDef } from "./types"

function GeoTab() { const { f } = useSelected(); return f ? <><PhotoSection /><GeometrySection rotation={false} /></> : <EmptyInspector /> }

/* ---------------------------------------------------------------- document-history */
function HistoryPanel() {
  const st = useStudio()
  const jump = (n: number) => { for (let i = 0; i < n; i++) st.undo() }
  const redoN = (n: number) => { for (let i = 0; i < n; i++) st.redo() }
  return (
    <aside className="flex min-h-0 flex-col border-l bg-chrome" data-testid="history-panel">
      <PanelHeader icon={<History />} title="History" meta={`${st.past.length} steps`} />
      <div className="flex gap-1.5 border-b p-2">
        <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-[13px] shadow-xs [&_svg]:size-4" isDisabled={!st.past.length} onPress={st.undo}><Undo2 />Undo</Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-[13px] shadow-xs [&_svg]:size-4" isDisabled={!st.future.length} onPress={st.redo}><Redo2 />Redo</Button>
      </div>
      <ol className="min-h-0 flex-1 overflow-auto p-1.5 text-[13px]">
        <li><button type="button" onClick={() => jump(st.past.length)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-accent/60">Opened book</button></li>
        {st.past.map((h, i) => (
          <li key={i}><button type="button" onClick={() => jump(st.past.length - 1 - i)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/60", i === st.past.length - 1 && "bg-accent font-medium")}>
            <span className="w-4 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>{h.label}</button></li>
        ))}
        {st.future.map((h, i) => (
          <li key={`f${i}`}><button type="button" onClick={() => redoN(i + 1)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground/60 line-through decoration-transparent hover:bg-accent/40">
            <span className="w-4 text-right text-[11px] tabular-nums">{st.past.length + i + 1}</span>{h.label}</button></li>
        ))}
      </ol>
      <div className="border-t p-3 text-[11.5px] leading-relaxed text-muted-foreground">Coalescing: typing in one field (X, W…) = one step. Selection, zoom and hover never enter the history.</div>
    </aside>
  )
}

/* ---------------------------------------------------------------- filmstrip-sort-filter */
function SortFilter() {
  return <Std features={{ drop: true, swap: true }} wrap={RemoveProvider} dock={<RemoveDock />} />
}
const RemoveCtx = React.createContext<(id: string) => void>(() => { })
function RemoveProvider({ children }: { children: React.ReactNode }) {
  const st = useStudio()
  const [ask, setAsk] = React.useState<string | null>(null)
  const remove = (id: string) => {
    st.update((d) => ({ ...d, gallery: d.gallery.filter((x) => x !== id), spreads: d.spreads.map((s) => ({ ...s, frames: s.frames.map((f) => (f.photo === id ? { ...f, photo: null } : f)) })) }), "Remove from gallery")
    st.setFilmSel([]); st.toast({ title: `${P(id).name} removed from the gallery`, description: "The file stays on disk.", action: { label: "Undo", onAction: st.undo } })
  }
  const req = (id: string) => (placedSet(st.doc).has(id) ? setAsk(id) : remove(id))
  return (
    <RemoveCtx.Provider value={req}>
      {children}
      <ConfirmDialog isOpen={!!ask} onCancel={() => setAsk(null)} onConfirm={() => { remove(ask!); setAsk(null) }}
        title="Remove a placed photo?" description={<>“{ask && P(ask).name}” is used in the book. Removing it empties that frame. The file on disk is not touched.</>} confirm="Remove and empty frame" />
    </RemoveCtx.Provider>
  )
}
function RemoveDock() { const req = React.useContext(RemoveCtx); return <Dock><Filmstrip removable onRemove={req} /></Dock> }

/* ---------------------------------------------------------------- filmstrip-resize-drop */
function ResizeDrop() { return <Std features={{ drop: true }} dock={<ResizableDock />} left={false} /> }
function ResizableDock() {
  const st = useStudio()
  const startDrag = (e: React.PointerEvent) => {
    const y0 = e.clientY, t0 = st.view.thumb
    const mv = (ev: PointerEvent) => st.setView({ thumb: Math.max(56, Math.min(180, Math.round(t0 + (y0 - ev.clientY)))) })
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
  }
  return (
    <div className="relative">
      <div onPointerDown={startDrag} role="separator" aria-orientation="horizontal" aria-label="Resize filmstrip" aria-valuenow={st.view.thumb} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "ArrowUp") st.setView({ thumb: Math.min(180, st.view.thumb + 8) }); if (e.key === "ArrowDown") st.setView({ thumb: Math.max(56, st.view.thumb - 8) }) }}
        className="group absolute -top-1.5 left-0 right-0 z-20 flex h-3 cursor-ns-resize items-center justify-center outline-hidden focus-visible:bg-ring/20" data-testid="dock-resize">
        <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-ring" />
      </div>
      <Dock right={<div className="flex items-center gap-2 text-xs text-muted-foreground">Thumbnails<SliderMini label="Thumbnail size" value={st.view.thumb} onChange={(v) => st.setView({ thumb: v })} min={56} max={180} /><span className="w-10 tabular-nums">{st.view.thumb}px</span></div>}
        left={<span className="text-xs text-muted-foreground">Drop JPEG/PNG files from your desktop onto the strip to import</span>}>
        <Filmstrip externalDrop />
      </Dock>
    </div>
  )
}

/* ---------------------------------------------------------------- template-slot-aspects */
function SlotAspects() { return <Std features={{ drop: true, multiDrop: true }} cur={3} dock={<AspectDock />} /> }
const Cls = ({ c }: { c: string }) => <span className={cn("inline-grid h-3.5 place-items-center rounded-[3px] border px-[3px] text-[8.5px] font-bold leading-none", c === "portrait" ? "border-[#7c5cc4]/50 text-[#7c5cc4]" : c === "landscape" ? "border-select/60 text-select" : "border-muted-foreground/40 text-muted-foreground")}>{c[0].toUpperCase()}</span>
function AspectDock() {
  const st = useStudio()
  const [cols, setCols] = React.useState(3), [rows, setRows] = React.useState(2)
  const sel = st.filmSel.length ? st.filmSel : null
  const best = sel ? bestTemplate(sel) : null
  const tpl = [...ALL_TEMPLATES]
  return (
    <Dock templates={
      <div className="flex items-start gap-3">
        <div className="flex gap-2.5 overflow-x-auto p-1 pb-2" data-testid="aspect-templates">
          {tpl.map((t) => (
            <button key={t.id} type="button" onClick={() => applyTemplate(st, t.id)} className={cn("flex shrink-0 flex-col gap-1 rounded-[5px] p-0.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring", best?.id === t.id && "ring-2 ring-success ring-offset-2 ring-offset-chrome", st.doc.spreads[st.cur]?.template === t.id && "ring-2 ring-select ring-offset-2 ring-offset-chrome")}>
              <TemplateThumb id={t.id} width={92} />
              <span className="flex w-[92px] items-center gap-0.5">{slotClasses(t).slice(0, 6).map((c, i) => <Cls key={i} c={c} />)}{best?.id === t.id && <Sparkles className="ml-auto size-3 text-success" />}</span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 rounded-lg border bg-card p-2 shadow-xs" data-testid="contact-sheet">
          <span className="text-[11px] font-medium">Contact sheet</span>
          <div className="flex items-center gap-1 text-xs">
            {[[cols, setCols], [rows, setRows]].map(([v, set], i) => (
              <NumberField key={i} aria-label={i ? "Rows" : "Columns"} value={v as number} onChange={set as (n: number) => void} minValue={1} maxValue={i ? 4 : 5} className="w-12"><FieldGroup className="h-7 px-1.5 text-xs shadow-xs"><NumberFieldInput className="px-0 text-center tabular-nums" /></FieldGroup></NumberField>
            )).reduce((a, b, i) => (i ? [...a, <span key={`x${i}`} className="text-muted-foreground">×</span>, b] : [b]), [] as React.ReactNode[])}
          </div>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs shadow-xs" onPress={() => applyTemplate(st, contactSheet(`t-cs-${cols}x${rows}`).id)}>Apply {cols * rows * 2} frames</Button>
        </div>
      </div>
    } defaultTab="templates" left={<span className="max-w-[300px] truncate text-xs text-muted-foreground">{best ? <>Best fit for {sel!.length} selected: <b className="text-foreground">{best.name}</b></> : "Select photos to see the best fit · P / L / S = slot aspect"}</span>} />
  )
}

/* ---------------------------------------------------------------- spread list + assets panel + presentation */
function AssetsPanel() {
  const st = useStudio()
  const [sort, setSort] = React.useState("status")
  const uses = (id: string) => st.doc.spreads.flatMap((s, i) => s.frames.filter((f) => f.photo === id).map(() => i))
  const status = (id: string) => (st.missing.has(id) ? "missing" : id === "p05" || id === "p19" ? "modified" : "ok")
  const [updated, setUpdated] = React.useState<string[]>([])
  const order = { missing: 0, modified: 1, ok: 2 }
  let rows = st.doc.gallery.map((id) => ({ id, st: updated.includes(id) ? "ok" : status(id), u: uses(id) }))
  rows = rows.sort((a, b) => sort === "status" ? order[a.st as "ok"] - order[b.st as "ok"] || b.u.length - a.u.length : sort === "uses" ? b.u.length - a.u.length : P(a.id).name.localeCompare(P(b.id).name))
  return (
    <aside className="flex min-h-0 flex-col border-r bg-chrome" data-testid="assets-panel">
      <PanelHeader title="Assets" meta={`${rows.length}`} />
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Tabs selectedKey={sort} onSelectionChange={(k) => setSort(String(k))}><TabList aria-label="Sort" size="sm">{[["status", "Status"], ["uses", "Uses"], ["name", "Name"]].map(([k, l]) => <Tab key={k} id={k}>{l}</Tab>)}</TabList></Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.map((r) => (
          <div key={r.id} className="group flex items-center gap-2 border-b border-border/60 px-2 py-1.5 text-[12px]">
            {r.st === "missing" ? <div className="grid h-8 w-10 shrink-0 place-items-center rounded border border-dashed text-muted-foreground"><ImageOff className="size-3.5" /></div> : <img src={P(r.id).src} alt="" className="h-8 w-10 shrink-0 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{P(r.id).name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{r.u.length ? `${r.u.length}× · spread ${[...new Set(r.u)].map((x) => x + 1).join(", ")}` : "unused"}</div>
            </div>
            {r.st === "missing" ? <Badge color="error" dot>missing</Badge> : r.st === "modified" ? (
              <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[11px] shadow-xs [&_svg]:size-3" onPress={() => { setUpdated((u) => [...u, r.id]); st.toast({ tone: "success", title: `${P(r.id).name} updated`, description: "Previews refreshed, crop kept." }, 3000) }}><RefreshCw />Update</Button>
            ) : <Badge color="success" dot className="opacity-70 group-hover:opacity-100">ok</Badge>}
            {r.u.length > 0 && <IconButton label="Jump to frame" size="sm" tooltip={false} onPress={() => { const si = r.u[0]; st.setCur(si); const f = st.doc.spreads[si].frames.find((x) => x.photo === r.id); if (f) st.setSel([f.id]); st.setStatus(`Jumped to ${P(r.id).name} on spread ${si + 1}`) }}><ArrowRight /></IconButton>}
          </div>
        ))}
      </div>
    </aside>
  )
}
function WideLeft({ children }: { children: React.ReactNode }) { return <div className="contents" style={{ ["--panel-left" as string]: "312px" }}>{children}</div> }
function PresentLayer() {
  const st = useStudio()
  const [on, setOn] = React.useState(false)
  const [i, setI] = React.useState(0)
  const touch = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!on) return
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOn(false)
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setI((x) => Math.min(st.doc.spreads.length - 1, x + 1)) }
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [on, st.doc.spreads.length])
  return (
    <>
      <Button size="sm" className="absolute right-3 top-3 z-30 h-8 gap-1.5 px-3 text-[13px] shadow-sm [&_svg]:size-4" onPress={() => { setI(st.cur); setOn(true) }} data-testid="present"><Presentation />Present</Button>
      {on && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d]" data-testid="presentation" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setI((x) => e.clientX - r.left > r.width / 2 ? Math.min(st.doc.spreads.length - 1, x + 1) : Math.max(0, x - 1)) }}
          onPointerDown={(e) => { touch.current = e.clientX }} onPointerUp={(e) => { if (touch.current !== null && Math.abs(e.clientX - touch.current) > 60) setI((x) => (e.clientX < touch.current! ? Math.min(st.doc.spreads.length - 1, x + 1) : Math.max(0, x - 1))); touch.current = null }}>
          <MiniSpread s={st.doc.spreads[i]} width={760} className="shadow-[0_20px_60px_rgb(0_0_0/.6)]" />
          <div className="mt-5 flex items-center gap-3 text-xs text-white/60"><ChevronLeft className="size-4" /><span className="tabular-nums">{i + 1} / {st.doc.spreads.length}</span><ChevronRight className="size-4" /><span className="ml-4">← → / click / swipe · Esc to exit</span></div>
          <button type="button" aria-label="Exit presentation" onClick={(e) => { e.stopPropagation(); setOn(false) }} className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="size-4" /></button>
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- ui-panels: resizable, collapsible */
function PanelsDemo() {
  const [l, setL] = React.useState(188), [r, setR] = React.useState(264)
  const [lc, setLc] = React.useState(false), [rc, setRc] = React.useState(false)
  const drag = (side: "l" | "r") => (e: React.PointerEvent) => {
    const x0 = e.clientX, w0 = side === "l" ? l : r
    const mv = (ev: PointerEvent) => { const d = ev.clientX - x0; const w = Math.max(150, Math.min(360, side === "l" ? w0 + d : w0 - d)); (side === "l" ? setL : setR)(w) }
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up)
  }
  const key = (side: "l" | "r") => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); (side === "l" ? setLc : setRc)(true); return }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 32 : 8) * (side === "l" ? 1 : -1)
    ;(side === "l" ? setL : setR)((w) => Math.max(150, Math.min(360, w + d)))
  }
  const handle = (side: "l" | "r") => <div role="separator" aria-orientation="vertical" aria-label={`Resize ${side === "l" ? "left" : "right"} panel`} tabIndex={0} onPointerDown={drag(side)} onKeyDown={key(side)} className="group relative z-20 -mx-1 w-2 cursor-ew-resize" data-testid={`resize-${side}`}><span className="absolute inset-y-0 left-1/2 w-px bg-transparent transition-colors group-hover:bg-ring group-focus-visible:bg-ring" /></div>
  return (
    <StudioProvider init={() => makeDoc()} features={{ drop: true }} cur={2}>
      <div className="flex h-full flex-col" style={{ ["--panel-left" as string]: `${l}px`, ["--panel-right" as string]: `${r}px` }}>
        <TopBar views={[]} />
        <div className="flex min-h-0 flex-1">
          {lc ? <div className="flex w-[44px] shrink-0 flex-col items-center border-r bg-chrome py-1.5"><IconButton label="Expand spreads  [" placement="right" onPress={() => setLc(false)}><PanelLeftOpen /></IconButton></div>
            : <div className="flex shrink-0" style={{ width: l }}><div className="flex min-h-0 min-w-0 flex-1 flex-col [&>aside]:flex-1"><SpreadsPanel onCollapse={() => setLc(true)} /></div></div>}
          {!lc && handle("l")}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col"><Viewport><StatusLine /><Pager /><div className="absolute left-3 top-3 z-30 rounded-md bg-popover/95 px-2 py-1 text-[11px] tabular-nums text-muted-foreground shadow-sm">left {lc ? "collapsed" : `${l}px`} · right {rc ? "collapsed" : `${r}px`} · stored in the browser</div></Viewport><Dock /></main>
          {!rc && handle("r")}
          {rc ? <div className="flex w-[44px] shrink-0 flex-col items-center border-l bg-chrome py-1.5"><IconButton label="Expand inspector  ]" placement="left" onPress={() => setRc(false)}><PanelRightOpen /></IconButton></div>
            : <div className="flex shrink-0" style={{ width: r }}><div className="flex min-h-0 min-w-0 flex-1 flex-col [&>aside]:flex-1"><InspectorPanel frame={<GeoTab />} onCollapse={() => setRc(true)} /></div></div>}
        </div>
        <Toasts />
      </div>
    </StudioProvider>
  )
}

export const M3: Record<string, FeatureDef> = {
  "document-history": {
    Demo: () => <Std features={{ drop: true, handles: true, swap: false }} right={<HistoryPanel />} top={<TopBar views={["snap"]} />} />,
    notes: {
      what: "Document snapshots with steps coalesced by operation key; a step list in the History panel, buttons and shortcuts.",
      where: "Undo / Redo in the top bar; History panel on the right (on demand in the product).",
      why: "Freedom to experiment: every action is reversible.",
      keys: [["Ctrl Z", "undo"], ["Shift Ctrl Z", "redo"], ["Ctrl Y", "redo (Windows)"]],
      edge: ["Drag a frame and change a photo — each gesture is one step", "Typing in X / W coalesces into one step", "A new action after undo discards the “future” steps", "History has a size limit — the oldest steps are evicted"],
    },
  },
  "filmstrip-sort-filter": {
    Demo: SortFilter,
    notes: {
      what: "Sort by capture date, name or import order; an “unplaced only” filter; remove from the gallery (× on a thumbnail or Delete) with a warning if the photo is already in the book.",
      where: "Right side of the dock header; × appears on thumbnail hover.",
      why: "Quickly find what is still unused and tidy the gallery without fear of breaking the book.",
      keys: [["Delete", "remove the selected photo from the gallery"], ["Ctrl Z", "bring it back"]],
      edge: ["An unplaced photo is removed immediately (toast with Undo)", "A placed one asks first in an AlertDialog: its frame will empty", "“Unplaced” filter with no results — an empty state with a hint", "The file on disk is never deleted"],
    },
  },
  "filmstrip-resize-drop": {
    Demo: ResizeDrop,
    notes: {
      what: "Filmstrip height / thumbnail size via a slider or by dragging the top edge of the dock; files dropped from the desktop onto the filmstrip are imported (for real in this demo, via object URLs).",
      where: "The editor bottom dock.",
      why: "Large thumbnails for culling, small ones for layout; import without dialogs.",
      keys: [["↑ ↓", "change the height when the splitter is focused"]],
      edge: ["Thumbnails ≥ 90 px show file names", "Unsupported files are rejected (drop operation cancel)", "The size is remembered in the browser"],
    },
  },
  "template-slot-aspects": {
    Demo: SlotAspects,
    notes: {
      what: "Every template slot has a P / L / S class; portrait templates were added; an N×M contact-sheet generator; a pure “best template” function highlights the one that fits the selected photos.",
      where: "Templates tab in the dock; photos are selected in the Photos tab.",
      why: "Portraits are not cropped into landscape slots; less manual cropping.",
      edge: ["Select 2 portrait photos (IMG_4160, IMG_4347) → “Two portraits” is highlighted", "Contact sheet up to 5×4 per page", "Best template considers both photo count and orientation"],
    },
  },
  "multi-drop-fill": {
    Demo: () => <Std features={{ drop: true, multiDrop: true, stack: true }} cur={7} pager={false} />,
    notes: {
      what: "Multi-select in the filmstrip (Shift / Ctrl+click); photos dropped on a spread fill its empty frames in gallery order; dropped between spreads they create a new spread with the best template.",
      where: "Filmstrip → pasteboard; “Drop here for a new spread” zones appear between spreads while dragging.",
      why: "A 20-spread book is laid out in minutes, not an hour.",
      keys: [["Shift click", "range in the filmstrip"], ["Ctrl click", "add to selection"], ["Ctrl A", "select all"]],
      edge: ["More photos than empty frames → the rest stay in the filmstrip and the status says how many", "Dropped on a filled frame → it is replaced, the rest go to empty frames", "The whole operation is one history step"],
    },
  },
  "crop-in-frame": {
    Demo: () => <Std features={{ drop: true, crop: true }} pick={0} right={<InspectorPanel frame={<CropTab />} />} />,
    notes: {
      what: "Double-click a photo → crop mode: drag moves the photo, wheel / slider zooms, arrows nudge; the part outside the frame is shown semi-transparent. “Reset to cover” restores the default.",
      where: "Canvas + the Fit & crop section of the inspector.",
      why: "Adjust the composition without touching the original.",
      keys: [["dbl-click", "enter crop"], ["wheel", "zoom while cropping"], ["← ↑ → ↓", "nudge (Shift ×10)"], ["Esc", "exit"]],
      edge: ["Zoom never goes below cover — no empty edges", "Panning is limited by the image edges", "Replacing the photo resets the crop"],
    },
  },
  "ui-panels": {
    Demo: PanelsDemo, h: 600,
    notes: {
      what: "Side panels collapse and resize by dragging their inner edge; sizes are remembered in the browser.",
      where: "Left (spreads) and right (inspector) editor panels.",
      why: "More canvas when laying out, more panel when editing numbers — without losing the setup.",
      keys: [["← →", "resize when the splitter is focused (Shift ×4)"], ["Enter", "collapse the panel when the splitter is focused"]],
      edge: ["Panels have min / max widths", "A collapsed panel leaves a thin rail to reopen it", "The overlay at the top left shows the current sizes"],
    },
  },
  "spread-list-panel": {
    Demo: () => <Std features={{ drop: true, stack: true }} cur={0} left={<SpreadsPanel actions />} pager={false} />,
    notes: {
      what: "Left panel with spread thumbnails (same renderer, small tier): click scrolls the pasteboard to the spread; the “…” menu adds after, duplicates, deletes.",
      where: "The editor left panel.",
      why: "Book navigation and structure in one place.",
      keys: [["↑ ↓", "move through the list"], ["Ctrl ↵", "add spread"], ["Ctrl D", "duplicate"], ["Delete", "delete"]],
      edge: ["Delete has no dialog but shows an Undo toast", "The last spread cannot be deleted", "“N empty” / “missing” badges on thumbnails"],
    },
  },
  "spread-reorder-retemplate": {
    Demo: () => <Std features={{ drop: true }} left={<SpreadsPanel reorder actions />} dock={<Dock templates defaultTab="templates" />} />,
    notes: {
      what: "Spreads are reordered by dragging in the left panel (react-aria DnD, keyboard too); changing a template keeps photos in order.",
      where: "Left panel; Templates tab in the dock.",
      why: "Change the story of the book without rebuilding spreads.",
      keys: [["Enter", "pick up a spread (on its drag handle), arrows move, Enter drops"]],
      edge: ["An insertion indicator appears between thumbnails", "A template with fewer frames → extra photos go to the filmstrip with a status", "Reordering is one history step"],
    },
  },
  "assets-panel": {
    Demo: () => <Std missing={["p11"]} features={{ drop: true }} left={<AssetsPanel />} wrap={WideLeft} />,
    notes: {
      what: "Assets panel: thumbnail, name, status (ok / missing / modified), how many times and on which spreads it is used; sorting; jump to the frame; Update for modified files.",
      where: "Left panel (Assets tab next to Spreads).",
      why: "Before printing — see whether everything is in place and what is used twice.",
      edge: ["An effective-DPI column arrives with dpi-badge", "Update keeps the crop and refreshes the preview", "Unused photos are marked “unused”"],
    },
  },
  "presentation-mode": {
    Demo: () => <Std features={{ drop: true }} canvasExtra={<PresentLayer />} />,
    notes: {
      what: "Full-screen show, one spread at a time, without editor chrome: arrows, click on a half of the screen, swipe; Esc exits.",
      where: "Present button (next to Preview in the product).",
      why: "See the book as a reader and show it to others.",
      keys: [["→ Space", "next"], ["←", "back"], ["Esc", "exit"]],
      edge: ["The pager is shared with site-lightbox", "On the last spread “next” does nothing", "Same SpreadView as the editor"],
    },
  },
}
function CropTab() { const { f } = useSelected(); return f ? <><CropSection /><GeometrySection rotation={false} /></> : <EmptyInspector hint="Double-click a photo to crop it, or select a frame." /> }

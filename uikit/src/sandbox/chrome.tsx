/* Sandbox editor chrome built from the ported JollyUI parts: top bar, spreads panel, filmstrip dock, status, toasts. */
import * as React from "react"
import { useInspectorOpen, toggleInspector, setInspectorOpen } from "./inspectorState"
import { PanelRight, PanelLeft, PanelBottom, Minus } from "lucide-react"
import { useDragAndDrop, isTextDropItem, isFileDropItem, isDirectoryDropItem, DIRECTORY_DRAG_TYPE, Button as AriaButton, type DirectoryDropItem, type FileDropItem, type DropItem } from "react-aria-components"
import {
  MousePointer2, SquareDashed, Type, Hand, Undo2, Redo2, Magnet, Grid3x3, Eye, Download, ChevronDown, ChevronLeft, ChevronRight,
  PanelLeftClose, Check, AlertTriangle, Plus, Loader2, Images, LayoutTemplate, Layers, BookOpen, Ruler, Filter, ArrowDownUp,
  Crosshair, Scan, X, ImageOff, Upload, CloudOff, MoreHorizontal, Copy, Trash2, FolderOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { Toolbar } from "@/components/ui/toolbar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabList, Tab, TabPanel, TabCount } from "@/components/ui/tabs"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator, MenuKeyboard } from "@/components/ui/menu"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { ToastRegion } from "@/components/ui/toast"
import { Slider, SliderTrack, SliderFillTrack, SliderThumb } from "@/components/ui/slider"
import { IconButton, ThumbGrid, ThumbItem, Kbd, AlertDialog, thumbWidth } from "@/components/app/ui"
import { photos, P, type Photo } from "@/data"
import { useStudio, placedSet, mapSpread } from "./store"
import { PhotoImg, PHOTO_TYPE, FRAME_TYPE } from "./canvas"
import { SW, SH, spread, parentOf, type Spread } from "./model"
import type { Node } from "./store"
import { pagesOf, pageLabel, pagesName, fmtN, coverW, SegC, CoverSpread, EndpaperSpread, MasterSpread, LastPage, MASTERS, useMasters, useCoverPhoto, T, SUB, BAR, FIELD, SURROUND, V7CSS } from "./v7"
import { ALL_TEMPLATES, TT } from "./templates"
import { metaOf } from "./meta"

export const toolToggle = "size-8 px-0 text-muted-foreground data-[hovered]:bg-accent/70 data-[hovered]:text-foreground data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm [&_svg]:size-4"
export const viewToggle = cn(toolToggle, "data-[selected]:bg-accent data-[selected]:shadow-none")
/* v3: Tabs carry their own geometry (ui/tabs.tsx); these stay as hooks for layout-only overrides */
export const segList = ""
export const segTab = ""
export const floatBar = "rounded-lg bg-popover p-1 shadow-md"
export const sbtn = "gap-1.5 px-3 text-sm [&_svg]:size-4"

export function AppMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-6 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3" /></div>
      {!compact && <span className="text-base font-semibold tracking-[-0.01em]">Photobooks</span>}
    </div>
  )
}

export function SaveStatus() {
  const st = useStudio()
  const s = st.saveState
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground" role="status" data-testid="save-status">
      {s === "saving" ? <><Loader2 className="size-3.5 animate-spin" />Saving…</>
        : s === "dirty" ? <><span className="size-1.5 rounded-full bg-warning" />Unsaved changes</>
        : s === "error" ? <><CloudOff className="size-3.5 text-destructive" />Not saved</>
        : <><Check className="size-3.5 text-success" />Saved</>}
    </span>
  )
}

type ViewKey = "snap" | "grid" | "guides" | "rulers" | "overlays" | "dpi"
const VIEW_TOGGLES: Record<ViewKey, [React.ComponentType<{ className?: string }>, string, string]> = {
  snap: [Magnet, "Snap", "Shift+S"], grid: [Grid3x3, "Layout grid", "Ctrl+'"], guides: [Crosshair, "Guides", "Ctrl+;"],
  rulers: [Ruler, "Rulers", "Shift+R"], overlays: [Scan, "Bleed / trim / safe", "Shift+B"], dpi: [AlertTriangle, "DPI badges", ""],
}
/** v4.3 (G-02): controlled tooltip for toggles inside toolbars / toggle groups. RAC's TooltipTrigger
 *  did not see blur from roving-focus toggles, so the tooltip stuck after keyboard focus left and
 *  ignored Escape. Here focus loss, Escape and hover end always close it. */
function ToolTip({ children, tip, className }: { children: React.ReactElement<Record<string, unknown>>; tip: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const focused = React.useRef(false), hovered = React.useRef(false)
  const child = React.cloneElement(children, {
    onFocusChange: (f: boolean) => { focused.current = f; if (!f) setOpen(false) },
    onHoverChange: (h: boolean) => { hovered.current = h; if (!h && !focused.current) setOpen(false) },
    onKeyDown: (e: React.KeyboardEvent & { continuePropagation?: () => void }) => { if (e.key === "Escape") setOpen(false); e.continuePropagation?.() },
  })
  // The trigger's delayed open can land after focus already moved on (fast Tab): accept it only while focused or hovered.
  const onOpenChange = (o: boolean) => setOpen(o && (focused.current || hovered.current))
  return (
    <TooltipTrigger delay={300} isOpen={open} onOpenChange={onOpenChange}>
      {child}
      {/* unmounted when closed, so no tooltip can linger in an exiting state */}
      {open && <Tooltip placement="bottom" className={cn("px-2 py-1 text-xs", className)}>{tip}</Tooltip>}
    </TooltipTrigger>
  )
}
export function ViewToggle({ k }: { k: ViewKey }) {
  const st = useStudio()
  const [I, l, sc] = VIEW_TOGGLES[k]
  return (
    <ToolTip className="flex items-center gap-2" tip={<>{l}{sc && <Kbd className="h-4.5">{sc}</Kbd>}</>}>
      <Toggle aria-label={l} size="sm" isSelected={st.view[k]} onChange={(v) => st.setView({ [k]: v })} className={viewToggle} data-testid={`toggle-${k}`}><I /></Toggle>
    </ToolTip>
  )
}
export function HistoryButtons() {
  const st = useStudio()
  const last = st.past[st.past.length - 1]?.label, next = st.future[0]?.label
  return (
    <>
      <IconButton label={last ? `Undo “${last}” (Ctrl+Z)` : "Nothing to undo"} isDisabled={!last} onPress={st.undo} data-testid="undo"><Undo2 /></IconButton>
      <IconButton label={next ? `Redo “${next}” (Shift+Ctrl+Z)` : "Nothing to redo"} isDisabled={!next} onPress={st.redo} data-testid="redo"><Redo2 /></IconButton>
    </>
  )
}
export function ToolGroup({ tools = ["select", "frame", "text", "hand"] }: { tools?: ("select" | "frame" | "text" | "hand")[] }) {
  const st = useStudio()
  const all = { select: [MousePointer2, "Select (V)"], frame: [SquareDashed, "Frame (F)"], text: [Type, "Text (T)"], hand: [Hand, "Pan (H)"] } as const
  return (
    <ToggleButtonGroup selectionMode="single" disallowEmptySelection selectedKeys={[st.view.tool]} onSelectionChange={(k) => { const v = [...k][0]; if (v) st.setView({ tool: v as "select" }) }}
      aria-label="Tool" className="gap-0.5 rounded-lg bg-muted p-0.5">
      {tools.map((id) => {
        const [I, l] = all[id]
        return (
          <ToolTip key={id} tip={l}>
            <Toggle id={id} aria-label={l} size="sm" className={toolToggle}><I /></Toggle>
          </ToolTip>
        )
      })}
    </ToggleButtonGroup>
  )
}
export function ZoomMenu() {
  const st = useStudio()
  return (
    <MenuTrigger>
      <Button variant="ghost" size="sm" className="gap-1 px-2 text-sm tabular-nums text-muted-foreground" data-testid="zoom-menu">{st.view.zoom === 1 ? "Fit" : `${Math.round(st.view.zoom * 100)}%`}<ChevronDown className="size-3.5 opacity-50" /></Button>
      <MenuPopover placement="bottom end" className="w-48">
        <Menu onAction={(k) => st.setView({ zoom: Number(k) })}>
          <MenuItem id="1">Fit spread <MenuKeyboard>Ctrl+0</MenuKeyboard></MenuItem>
          <MenuItem id="1.5">150%</MenuItem><MenuItem id="2">200%</MenuItem><MenuItem id="4">400%</MenuItem>
          <MenuSeparator /><MenuItem id="0.5">50%</MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
}

function InspectorToggle() {
  const open = useInspectorOpen()
  return <IconButton label={open ? "Hide inspector (I)" : "Show inspector (I)"} size="sm" aria-pressed={open} onPress={toggleInspector} className={cn(open && "bg-accent text-foreground")} data-testid="inspector-toggle"><PanelRight /></IconButton>
}
export function TopBar({ tools = true, history = true, views = ["snap", "grid"], zoom = true, save = true, right, center, title = "Untitled book", primary = true, publish, exportPrimary, printErrors, onLibrary, onPreview }: {
  onLibrary?: () => void
  onPreview?: () => void
  tools?: boolean | ("select" | "frame" | "text" | "hand")[]; history?: boolean; views?: ViewKey[]; zoom?: boolean; save?: boolean
  right?: React.ReactNode; center?: React.ReactNode; title?: string; primary?: boolean
  /** v4.1: optional Publish slot. Fixed order on every screen: status · zoom · panels · Preview · [Publish] · Export. */
  publish?: React.ReactNode
  /** v4.1: one primary per view. */
  exportPrimary?: boolean
  /** v4.3: preflight error count; when set, Export opens a menu where Print PDF is blocked by errors. */
  printErrors?: number
}) {
  // v0.7.1: the ONE editor's header (was Editor7's bar): Library · title + size/pages · tools · history · zoom · panel toggles · Preview · Export
  void exportPrimary
  const st = useStudio()
  const empty = !!st && st.doc.gallery.length === 0
  const pages = pagesOf(st.doc.spreads.length)
  const isBook = st.node?.k === "book"
  const exportBtn = <Button variant="ghost" size="sm" isDisabled={empty} disabledReason={empty ? "Add a photo folder first — the book is empty" : undefined} className="e7-sec h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={{ background: FIELD, color: T }} data-testid="export"><Upload />Export</Button>
  return (
    <header className="relative z-10 flex h-12 shrink-0 items-center gap-2 px-3" style={{ background: BAR, color: T }} data-testid="editor-bar">
      <Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" style={{ color: SUB }} onPress={onLibrary} data-testid="editor-library"><ChevronLeft />Library</Button>
      <button type="button" className="e7-title ml-1 flex h-8 items-baseline gap-2 rounded-md border-0 px-2.5 pt-1.5" aria-pressed={isBook} aria-label="Book settings" title="Book settings" data-testid="book-title" onClick={() => st.setNode(isBook ? null : { k: "book" })}>
        <span className="text-md" style={{ fontFamily: "var(--font-heading)", color: T }}><em>{title}</em></span>
        <span className="text-sm tabular-nums" style={{ color: SUB }} data-testid="book-size">{fmtN(st.book.w)} × {fmtN(st.book.h)} cm · {pages} pages{save ? ` · ${st.saveState === "saving" ? "saving" : st.saveState === "error" ? "not saved" : "saved"}` : ""}</span></button>
      {history && <div className="ml-2 flex items-center"><HistoryButtons /></div>}
      <div className="mx-auto flex items-center">
        {center ?? (
          <Toolbar aria-label="Tools" className="items-center gap-1">
            {tools && <ToolGroup tools={Array.isArray(tools) ? tools : undefined} />}
            {views.map((k) => <ViewToggle key={k} k={k} />)}
          </Toolbar>
        )}
      </div>
      {zoom && <div className="flex items-center gap-0.5 text-sm" style={{ color: SUB }}>
        <IconButton label="Zoom out (Ctrl −)" size="sm" onPress={() => st.setView({ zoom: Math.max(0.25, st.view.zoom / 1.25) })} data-testid="zoom-out"><Minus /></IconButton>
        <ZoomMenu />
        <IconButton label="Zoom in (Ctrl +)" size="sm" onPress={() => st.setView({ zoom: Math.min(8, st.view.zoom * 1.25) })} data-testid="zoom-in"><Plus /></IconButton></div>}
      <PanelToggles />
      {right ?? (primary && (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={{ background: FIELD, color: T }} onPress={onPreview} data-testid="editor-preview"><Eye />Preview</Button>
          {publish}
          {printErrors !== undefined && !empty ? (
            /* v4.3 (G-03): preflight errors block Print PDF only; Export stays enabled and its menu explains why. */
            <MenuTrigger>
              {exportBtn}
              <MenuPopover placement="bottom end" className="w-64">
                <Menu aria-label="Export" disabledKeys={printErrors > 0 ? ["pdf"] : []} data-testid="export-menu">
                  <MenuItem id="pdf" textValue="Print PDF" aria-describedby={printErrors > 0 ? "export-menu-pdf-reason" : undefined}>
                    <span className="flex min-w-0 flex-1 flex-col"><span className="flex items-center gap-2">Print PDF…{printErrors > 0 && <span className="rounded-full bg-destructive/10 px-1.5 text-2xs font-semibold tabular-nums text-destructive" aria-label={`${printErrors} errors`}>{printErrors}</span>}</span>
                      {printErrors > 0 && <span id="export-menu-pdf-reason" className="text-xs text-muted-foreground" data-testid="export-menu-reason">{`Fix ${printErrors} error${printErrors === 1 ? "" : "s"} to export · see Preflight`}</span>}</span>
                  </MenuItem>
                  <MenuItem id="jpeg">JPEG spreads…</MenuItem>
                  <MenuItem id="site">Static site…</MenuItem>
                </Menu>
              </MenuPopover>
            </MenuTrigger>
          ) : exportBtn}
        </div>
      ))}
    </header>
  )
}
function PanelToggles() {
  const st = useStudio(), r = useInspectorOpen()
  const tg = (k: "l" | "b" | "r", name: string, key: string, I: React.ComponentType<{ className?: string }>) => {
    const on = k === "r" ? r : st.panels[k]
    return <button key={k} type="button" className="e7-ghost e7-tip e7-tog grid size-8 place-items-center rounded-md [&_svg]:size-4" style={{ color: SUB }} aria-pressed={on} aria-label={`${on ? "Hide" : "Show"} ${name}`} data-testid={`toggle-${k}`}
      onClick={() => k === "r" ? toggleInspector() : st.setPanels({ ...st.panels, [k]: !on })}><I /><span className="e7-tt" aria-hidden>{on ? "Hide" : "Show"} {name}<kbd>{key}</kbd></span></button>
  }
  return <div className="ml-1 flex items-center gap-0.5" role="group" aria-label="Panels">{tg("l", "spreads", "[", PanelLeft)}{tg("b", "photos", "\\", PanelBottom)}{tg("r", "inspector", "]", PanelRight)}</div>
}

/* ---------------------------------------------------------------- mini spread (thumbnails) */
export function MiniSpread({ s, width = 0, className, si, fill }: { s: Spread; width?: number; className?: string; si?: number; fill?: boolean }) {
  const st = useStudio()
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null)
  const [fw, setFw] = React.useState(0)
  React.useLayoutEffect(() => { if (!fill || !ref) return; const ro = new ResizeObserver(([e]) => setFw(e.contentRect.width)); ro.observe(ref); return () => ro.disconnect() }, [fill, ref])
  if (fill) width = fw
  const sc = width / SW
  const par = parentOf(st.doc, s)
  const fr = [...(par?.frames ?? []), ...s.frames]
  return (
    <div ref={setRef} className={cn("relative shrink-0 overflow-hidden rounded-2xs shadow-thumb", fill && "size-full", className)} data-paper
      style={{ ...(fill ? {} : { width, height: SH * sc }), background: s.bg ?? "var(--paper,#fff)", clipPath: si === 0 ? "inset(0 0 0 50%)" : undefined }}>
      {fr.map((f) => (
        <div key={f.id} className="absolute overflow-hidden" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }}>
          {f.kind === "text" ? <div className="mt-[30%] h-0.5 w-3/4 rounded bg-black/25" />
            : f.photo && !st.missing.has(f.photo) ? <PhotoImg f={f} wpx={f.w * sc} hpx={f.h * sc} />
            : <div className={cn("size-full", f.photo ? "hatch-missing-sm" : "bg-placeholder")} />}
        </div>
      ))}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/10" />
    </div>
  )
}
export function TemplateThumb({ id, width, className, photos: ph }: { id: string; width: number; className?: string; photos?: (string | null)[] }) {
  const t = TT(id)
  return (
    <div className={cn("relative shrink-0 rounded-2xs bg-paper shadow-hairline", className)} style={{ width, height: width / 2 }}>
      {t.frames.map((b, i) => (
        <div key={i} className="absolute overflow-hidden rounded-2xs bg-placeholder-block" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}>
          {ph?.[i] && <img src={P(ph[i]!).src} className="size-full object-cover" alt="" />}
        </div>
      ))}
      <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
    </div>
  )
}

/* ---------------------------------------------------------------- left: spreads */
export function PanelHeader({ icon, title, meta, children }: { icon?: React.ReactNode; title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 pl-3 pr-1.5">
      {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {meta && <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>}
      <div className="ml-auto flex items-center">{children}</div>
    </div>
  )
}
type ListItem = { key: string; label: string; ratio: number; thumb: React.ReactNode; node: Node; si?: number; align?: "l" | "r" }
export function SpreadsPanel({ reorder = false, actions = false, onCollapse }: { reorder?: boolean; actions?: boolean; onCollapse?: () => void }) {
  // v0.7.1: the ONE editor's list (was Editor7's list): Pages | Masters · Cover · Endpaper · 1 · 2–3 … · last page · Endpaper
  void onCollapse
  const st = useStudio(), bk = st.book, masters = useMasters()
  const SR = (2 * bk.w) / bk.h, CR = coverW(bk) / bk.h, n = st.doc.spreads.length
  const list: ListItem[] = st.mode === "masters"
    ? (["A", "B"] as const).map((id) => ({ key: `m${id}`, label: `Master ${id}`, ratio: SR, node: { k: "master", id }, thumb: <MasterSpread id={id} m={masters[id]} /> }))
    : [{ key: "cover", label: "Cover", ratio: CR, node: { k: "cover" }, thumb: <CoverSpread /> },
      ...(bk.endp ? [{ key: "ef", label: "Endpaper", ratio: SR, node: { k: "endpaper", w: "front" } as Node, thumb: <EndpaperSpread which="front" /> }] : []),
      ...st.doc.spreads.map((s, i) => ({ key: `p${i}`, label: pageLabel(i), ratio: SR, node: null, si: i, align: i === 0 ? "r" as const : undefined, thumb: <MiniSpread s={s} si={i} fill /> })),
      { key: "last", label: `${pagesOf(n)}`, ratio: SR, node: { k: "last" } as Node, align: "l" as const, thumb: <LastPage /> },
      ...(bk.endp ? [{ key: "eb", label: "Endpaper", ratio: SR, node: { k: "endpaper", w: "back" } as Node, thumb: <EndpaperSpread which="back" /> }] : [])]
  const keyOf = (): string => { const nd = st.node; if (!nd) return st.mode === "masters" ? "mA" : `p${st.cur}`; if (nd.k === "cover") return "cover"; if (nd.k === "endpaper") return nd.w === "front" ? "ef" : "eb"; if (nd.k === "master") return `m${nd.id}`; if (nd.k === "last") return "last"; return "" }
  const selKey = keyOf()
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ "text/plain": String(k) })),
    onReorder(e) {
      const ids = [...e.keys].map(String).filter((k) => /^p\d+$/.test(k)).map((k) => st.doc.spreads[+k.slice(1)].id)
      const tk = String(e.target.key); if (!ids.length || !/^p\d+$/.test(tk)) return
      const tid = st.doc.spreads[+tk.slice(1)].id
      st.update((d) => {
        const moving = d.spreads.filter((s) => ids.includes(s.id))
        const rest = d.spreads.filter((s) => !ids.includes(s.id))
        let at = rest.findIndex((s) => s.id === tid)
        if (e.target.dropPosition === "after") at += 1
        const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
        st.setCur(next.findIndex((s) => s.id === ids[0]))
        return { ...d, spreads: next }
      }, "Reorder spreads")
      st.setStatus(`Moved spread to pages ${pageLabel(1 + st.doc.spreads.findIndex((s) => s.id === tid))}`)
    },
  })
  const pick = (k: string) => { const it = list.find((x) => x.key === k); if (!it) return; if (it.si !== undefined) { st.setCur(it.si); st.setSel([]) } else st.setNode(it.node) }
  return (
    <aside className="flex h-full min-h-0 flex-col" style={{ background: BAR, color: T }} data-testid="spreads-panel">
      <div className="shrink-0 px-3 pb-2 pt-3" data-testid="mode-seg"><SegC items={["Pages", "Masters"]} on={st.mode === "pages" ? 0 : 1} set={(i) => { const m = i ? "masters" : "pages"; st.setMode(m); st.setNode(m === "masters" ? { k: "master", id: "A" } : null) }} /></div>
      <ThumbGrid key={st.mode} aria-label={st.mode === "masters" ? "Masters" : "Pages"} selectionMode="single" disallowEmptySelection={false} selectedKeys={selKey ? [selKey] : []} items={list}
        onSelectionChange={(k) => { const id = [...k][0]; if (id !== undefined) pick(String(id)) }}
        dragAndDropHooks={reorder && st.mode === "pages" ? dragAndDropHooks : undefined}
        className="e7 scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-4 pl-3 pr-1" data-testid="list">
        {(it) => (
          <ThumbItem id={it.key} textValue={it.label} data-item={it.key}
            className="e7-item group/sp relative mb-1 rounded-md p-2 ring-0! ring-offset-0! outline-none data-[dragging]:opacity-40">
            {reorder && <AriaButton slot="drag" className="sr-only">{it.si !== undefined ? `Drag pages ${it.label}` : `${it.label} (fixed position)`}</AriaButton>}
            <div className="grid w-full place-items-center" style={{ aspectRatio: `${Math.max(it.ratio, 1.6)}` }}><div style={{ width: it.ratio >= 1.6 ? "100%" : `${(it.ratio / 1.6) * 100}%`, aspectRatio: `${it.ratio}`, position: "relative" }}>{it.thumb}</div></div>
            {actions && it.si !== undefined && <SpreadItemMenu i={it.si} />}
            <div className="mt-1.5 flex text-2xs tabular-nums" style={{ paddingLeft: it.align === "r" ? "50%" : undefined }}>
              <span data-label className={cn(it.key === selKey ? "font-semibold" : "font-normal")} style={{ color: it.key === selKey ? T : SUB }}>{it.label}</span>
              {it.si !== undefined && st.doc.spreads[it.si].frames.some((f) => f.kind === "image" && !f.photo) && <span className="ml-auto text-warning-fg">{st.doc.spreads[it.si].frames.filter((f) => f.kind === "image" && !f.photo).length} empty</span>}
              {it.si !== undefined && st.doc.spreads[it.si].frames.some((f) => f.photo && st.missing.has(f.photo)) && <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-destructive"><AlertTriangle className="size-3" aria-hidden />missing</span>}
            </div>
          </ThumbItem>
        )}
      </ThumbGrid>
      {st.mode === "masters" && <button type="button" className="e7-ghost mx-3 mb-3 flex h-8 items-center gap-1.5 rounded-md px-2 text-sm [&_svg]:size-3.5" style={{ color: SUB }}><Plus />New master</button>}
      {actions && st.mode === "pages" && <SpreadActions />}
    </aside>
  )
}
/* proto: the spread thumbnail follows the list column width — no horizontal scroll, the "…" menu stays inside */
function FitMini({ s, className }: { s: Spread; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  return <div ref={ref} className="w-full min-w-0">{w > 0 && <MiniSpread s={s} width={w - 4} className={className} />}</div>
}
function SpreadItemMenu({ i }: { i: number }) {
  const st = useStudio()
  const dup = () => {
    const src = st.doc.spreads[i]
    const copy: Spread = { ...src, id: `s${Date.now()}`, frames: src.frames.map((f) => ({ ...f, id: `${f.id}c${Date.now() % 1000}` })) }
    st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, i + 1), copy, ...d.spreads.slice(i + 1)] }), "Duplicate spread")
    st.setCur(i + 1); st.setStatus(`${pagesName(i)} duplicated`)
  }
  const del = () => {
    if (st.doc.spreads.length <= 1) return
    st.update((d) => ({ ...d, spreads: d.spreads.filter((_, j) => j !== i) }), "Delete spread")
    st.setCur(Math.max(0, i - 1))
    st.toast({ title: `${pagesName(i)} deleted`, description: "Its photos are back in the gallery.", action: { label: "Undo", onAction: st.undo } })
  }
  return (
    <MenuTrigger>
      <AriaButton aria-label={`${pagesName(i)} actions`} className="absolute right-2.5 top-2.5 z-10 grid size-6 place-items-center rounded-md bg-popover/90 text-muted-foreground opacity-0 shadow-sm outline-hidden group-data-[hovered]/sp:opacity-100 group-data-[selected]/sp:opacity-100 data-[focus-visible]:opacity-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring" data-testid="spread-menu"><MoreHorizontal className="size-3.5" /></AriaButton>
      <MenuPopover placement="bottom end" className="w-44">
        <Menu className="[&_svg]:size-4 [&_svg]:text-muted-foreground" onAction={(k) => { if (k === "dup") dup(); if (k === "del") del(); if (k === "add") { st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, i + 1), spread("t-pair"), ...d.spreads.slice(i + 1)] }), "Add spread"); st.setCur(i + 1) } }}>
          <MenuItem id="add"><Plus />Add after<MenuKeyboard>Ctrl+↵</MenuKeyboard></MenuItem>
          <MenuItem id="dup"><Copy />Duplicate<MenuKeyboard>Ctrl+D</MenuKeyboard></MenuItem>
          <MenuSeparator />
          <MenuItem id="del" isDisabled={st.doc.spreads.length <= 1} variant="destructive"><Trash2 />Delete<MenuKeyboard>Del</MenuKeyboard></MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
}
export function SpreadActions() {
  const st = useStudio()
  const add = () => {
    const i = st.cur + 1
    st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, i), spread("t-pair"), ...d.spreads.slice(i)] }), "Add spread")
    st.setCur(i); st.setStatus(`Added spread ${i + 1}`)
  }
  return (
    <div className="flex items-center gap-1 p-1">
      <Button variant="ghost" size="sm" onPress={add} className="flex-1 justify-start gap-2 px-2 text-sm text-muted-foreground [&_svg]:size-4" data-testid="add-spread"><Plus />Add spread</Button>
      <Kbd className="mr-1">Ctrl+↵</Kbd>
    </div>
  )
}

/* ---------------------------------------------------------------- bottom: filmstrip dock */
export function sortedGallery(ids: string[], sort: "date" | "name" | "added") {
  const a = [...ids]
  if (sort === "name") a.sort((x, y) => P(x).name.localeCompare(P(y).name))
  else if (sort === "date") a.sort((x, y) => +metaOf(x).date - +metaOf(y).date)
  else a.sort((x, y) => metaOf(x).added - metaOf(y).added)
  return a
}
let ext = 0
export function Filmstrip({ removable = false, externalDrop = false, sortable = true, onRemove }: { removable?: boolean; externalDrop?: boolean; sortable?: boolean; onRemove?: (id: string) => void }) {
  const st = useStudio()
  const cov = useCoverPhoto(), placed = withCover(placedSet(st.doc), cov, st.doc.gallery)
  let ids = sortable ? sortedGallery(st.doc.gallery, st.view.sort) : st.doc.gallery
  if (st.view.unplacedOnly) ids = ids.filter((id) => !placed.has(id))
  const items = ids.map((id) => P(id)).filter(Boolean)
  const [fileOver, setFileOver] = React.useState(false)
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ [PHOTO_TYPE]: String(k), "text/plain": P(String(k)).name })),
    acceptedDragTypes: [FRAME_TYPE, DIRECTORY_DRAG_TYPE, "image/jpeg", "image/png", "image/webp"],
    getDropOperation: () => "move",
    onDragStart: (e) => { st.setDragging([...e.keys].map(String)); st.setStatus(`Dragging ${e.keys.size} photo${e.keys.size > 1 ? "s" : ""} — drop on a frame${st.features.multiDrop ? ", a spread or between spreads" : ""}`) },
    onDragEnd: () => { st.setDragging(null); setTimeout(() => st.setStatus(""), 2500) },
    onRootDrop: (e) => handleDrop(e),
    // dropped over a thumbnail instead of empty strip: same handling (external folders / frames back to the gallery)
    onInsert: (e) => handleDrop(e),
    onItemDrop: (e) => handleDrop(e),
    onDropEnter: () => setFileOver(true), onDropExit: () => setFileOver(false),
  })
  async function handleDrop(e: { items: DropItem[] }) {
      setFileOver(false)
      // v4: import is folder-only. A dropped folder (and its subfolders) is imported; loose files are not.
      const dirs = e.items.filter(isDirectoryDropItem)
      const loose = e.items.filter(isFileDropItem)
      if (externalDrop && (dirs.length || loose.length)) {
        if (!dirs.length) {
          /* v0.9 §3: no floating toast for photo-folder / filmstrip events */
          st.setStatus("Drop a folder — Photobooks adds folders, not single photos")
          return
        }
        const files: FileDropItem[] = []
        const walk = async (d: DirectoryDropItem) => { for await (const x of d.getEntries()) { if (x.kind === "directory") await walk(x); else if (/^image\/(jpeg|png|webp)$/.test(x.type)) files.push(x) } }
        for (const d of dirs) await walk(d)
        const added: Photo[] = []
        for (const f of files) {
          const file = await f.getFile()
          const url = URL.createObjectURL(file)
          const dim = await new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 3000, h: 2000 }); im.src = url })
          const p: Photo = { id: `x${++ext}`, src: url, name: file.name, w: dim.w, h: dim.h, credit: { title: file.name, author: "you", url: "" } }
          photos.push(p); added.push(p)
        }
        const names = dirs.map((d) => d.name).join(", ")
        if (!added.length) { st.setStatus(`No photos in “${names}”`); return }
        st.update((d) => ({ ...d, gallery: [...d.gallery, ...added.map((p) => p.id)] }), `Import folder ${names}`)
        st.setStatus(loose.length
          ? `Added ${added.length} photo${added.length > 1 ? "s" : ""} from “${names}” · ${loose.length} loose file${loose.length > 1 ? "s" : ""} ignored`
          : `Added ${added.length} photo${added.length > 1 ? "s" : ""} from “${names}”`)
        return
      }
      for (const it of e.items.filter(isTextDropItem)) {
        if (!it.types.has(FRAME_TYPE)) continue
        const [si, fid] = (await it.getText(FRAME_TYPE)).split(":")
        const ph = st.doc.spreads[Number(si)].frames.find((f) => f.id === fid)?.photo
        st.update((d) => mapSpread(d, Number(si), (s) => ({ ...s, frames: s.frames.map((f) => (f.id === fid ? { ...f, photo: null } : f)) })), "Unplace photo")
        if (ph) st.setStatus(`${P(ph).name} is back in the gallery — the frame is empty`)
      }
  }
  React.useEffect(() => {
    if (!removable) return
    const on = (e: KeyboardEvent) => { if ((e.key === "Delete" || e.key === "Backspace") && st.filmSel.length && (e.target as HTMLElement).closest("[data-filmstrip]")) onRemove?.(st.filmSel[0]) }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  }, [removable, st.filmSel, onRemove])
  return (
    <div className="relative" data-filmstrip>
      <ThumbGrid aria-label="Photos" layout="grid" selectionMode="multiple" selectionBehavior="replace" items={items} dependencies={[placed]}
        selectedKeys={st.filmSel} onSelectionChange={(k) => st.setFilmSel(k === "all" ? items.map((p) => p.id) : [...k].map(String))}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => <div className="flex h-(--thumb) items-center px-2 text-sm text-muted-foreground">{st.view.unplacedOnly ? "Every photo is placed. Turn off “Unplaced” to see all." : "No photos yet — add a folder or drop one here."}</div>}
        className="scroll-thin flex gap-2 overflow-x-auto overflow-y-hidden p-1 pb-2" data-testid="filmstrip">
        {(p) => {
          const h = st.view.thumb
          const w = thumbWidth(p.w, p.h, h) // shared aspect rule (app/ui PhotoThumb): true ratio, clamped 5:8…8:5
          const miss = st.missing.has(p.id)
          return (
            <ThumbItem id={p.id} textValue={p.name} className="group/th shrink-0 overflow-hidden rounded-xs shadow-hairline ring-0! ring-offset-0! outline-none data-[selected]:bg-sel data-[dragging]:opacity-40">
              <AriaButton slot="drag" className="sr-only">Drag {p.name}</AriaButton>
              <div style={{ width: w, height: h }} className="relative">
                {miss ? <div className="grid size-full place-items-center bg-muted text-muted-foreground"><ImageOff className="size-4" /></div>
                  : <img src={p.src} className="size-full object-cover" draggable={false} alt="" />}
                {placed.has(p.id) && <span className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm" title="Placed in the book"><Check className="size-2.5" strokeWidth={3} /></span>}
                {p.lowres && <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-xs bg-field px-1 py-px text-2xs font-medium text-ink-warning" data-testid="lowres-chip"><AlertTriangle className="size-2.5" />Low-res</span>}
                {removable && (
                  <button type="button" aria-label={`Remove ${p.name} from gallery`} onClick={(e) => { e.stopPropagation(); onRemove?.(p.id) }} onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-1 top-1 hidden size-5 place-items-center rounded-full bg-black/60 text-white group-hover/th:grid"><X className="size-3" /></button>
                )}
              </div>
              {h >= 90 && <div className="truncate bg-chrome px-1 py-0.5 text-2xs text-muted-foreground" style={{ width: w }}>{p.name}</div>}
            </ThumbItem>
          )
        }}
      </ThumbGrid>
      {fileOver && externalDrop && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-select/15 outline-2 -outline-offset-2 outline-dashed outline-mark text-sm font-medium">Drop a folder to add its photos</div>}
    </div>
  )
}
export function Dock({ children, left, right, templates = false, tabs = true, defaultTab = "photos" }: { children?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; templates?: boolean | React.ReactNode; tabs?: boolean; defaultTab?: string }) {
  const st = useStudio()
  const cov = useCoverPhoto(), placed = withCover(placedSet(st.doc), cov, st.doc.gallery)
  const chip = "h-7 gap-1.5 px-2 text-xs text-muted-foreground [&_svg]:size-3.5 data-[hovered]:bg-accent/70 data-[hovered]:text-foreground data-[selected]:bg-accent data-[selected]:text-foreground"
  return (
    <div className="shrink-0" style={{ background: BAR }} data-testid="dock">
      <Tabs defaultSelectedKey={defaultTab} className="gap-0">
        <div className="flex h-10 items-center gap-3 px-3">
          {/* v0.8 §3.1: Photos-only dock → no tab capsule, just the one plain label */}
          {tabs && templates !== false && (
            <TabList aria-label="Dock" className={segList}>
              <Tab id="photos" className={segTab}><Images />Photos</Tab>
              <Tab id="templates" className={segTab}><LayoutTemplate />Templates</Tab>
            </TabList>
          )}
          {left ?? <span className="text-sm tabular-nums" style={{ color: SUB }} data-testid="film-head"><span data-testid="placed-count">{tabs && templates !== false ? "" : "Photos · "}{st.doc.gallery.length} · {placed.size} used</span></span>}
          <div className="ml-auto flex items-center gap-1">
            {right ?? (
              <>
                <Toggle size="sm" isSelected={st.view.unplacedOnly} onChange={(v) => st.setView({ unplacedOnly: v })} className={chip}><Filter />Unplaced</Toggle>
                <MenuTrigger>
                  <Button variant="ghost" size="md" className={chip}><ArrowDownUp />{{ date: "Date taken", name: "File name", added: "Added order" }[st.view.sort]}</Button>
                  <MenuPopover placement="bottom end" className="w-44">
                    <Menu selectionMode="single" selectedKeys={[st.view.sort]} onSelectionChange={(k) => { const v = [...k][0]; if (v) st.setView({ sort: v as "date" }) }}>
                      <MenuItem id="date">Date taken</MenuItem><MenuItem id="name">File name</MenuItem><MenuItem id="added">Added order</MenuItem>
                    </Menu>
                  </MenuPopover>
                </MenuTrigger>
              </>
            )}
          </div>
        </div>
        {templates === false ? <div className="mt-0 px-2 pb-1" data-testid="film-panel">{children ?? <Filmstrip />}</div> : <TabPanel id="photos" className="mt-0 px-2 pb-1">{children ?? <Filmstrip />}</TabPanel>}
        {templates !== false && <TabPanel id="templates" className="mt-0 px-3 pb-2">{templates === true ? <TemplateBar /> : templates}</TabPanel>}
      </Tabs>
    </div>
  )
}
export function applyTemplate(st: ReturnType<typeof useStudio>, tid: string) {
  const s = st.doc.spreads[st.cur]
  const ph = s.frames.filter((f) => f.kind === "image").map((f) => f.photo).filter(Boolean) as string[]
  const t = TT(tid)
  const kept = ph.slice(0, t.count), dropped = ph.length - kept.length
  st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...spread(tid, kept), id: sp.id, guides: sp.guides, parent: sp.parent, bg: sp.bg, frames: [...spread(tid, kept).frames, ...sp.frames.filter((f) => f.kind === "text")] })), `Template “${t.name}”`)
  st.setSel([])
  st.setStatus(dropped ? `${dropped} photo${dropped > 1 ? "s" : ""} returned to the gallery — “${t.name}” has ${t.count} frame${t.count > 1 ? "s" : ""}` : `Applied “${t.name}” · photos kept in order`)
}
export function TemplateBar({ ids, extra }: { ids?: string[]; extra?: React.ReactNode }) {
  const st = useStudio()
  const list = (ids ?? ALL_TEMPLATES.map((t) => t.id)).map((id) => TT(id))
  const s = st.doc.spreads[st.cur]
  return (
    <div className="flex items-center gap-2">
      <ThumbGrid aria-label="Templates" layout="grid" selectionMode="single" selectedKeys={s?.template ? [s.template] : []} items={list}
        onSelectionChange={(k) => { const id = [...k][0]; if (id && id !== s.template) applyTemplate(st, String(id)) }}
        className="flex gap-2 overflow-x-auto p-1 pb-2" data-testid="template-bar">
        {(t) => (
          <ThumbItem id={t.id} textValue={t.name} className="flex shrink-0 flex-col gap-1 rounded-xs ring-0! ring-offset-0! outline-none data-[selected]:bg-sel p-0.5">
            <TemplateThumb id={t.id} width={92} />
            <span className="w-[92px] truncate text-2xs text-muted-foreground">{t.name}</span>
          </ThumbItem>
        )}
      </ThumbGrid>
      {extra}
    </div>
  )
}

/* ---------------------------------------------------------------- status + floating pager */
export function StatusLine() {
  const st = useStudio()
  return <div className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-[60%] truncate rounded-md bg-popover/95 px-3 py-1 text-xs text-muted-foreground shadow-sm empty:hidden" role="status" aria-live="polite" data-testid="status">{st.status}</div>
}
export function Pager() {
  const st = useStudio()
  if (st.node && st.node.k !== "none" && st.node.k !== "book") return null // cover / endpaper / master / last page views have no page pager
  if (st.mode === "masters") return null
  return (
    <div className={cn(floatBar, "absolute bottom-3 right-3 z-30 flex items-center gap-0.5 px-0.5 py-0.5 text-xs")} data-testid="pager">
      <IconButton label="Previous pages (←)" tooltip={false} size="sm" isDisabled={st.cur === 0} onPress={() => { st.setCur(st.cur - 1); st.setSel([]) }}><ChevronLeft /></IconButton>
      <span className="px-1 tabular-nums text-muted-foreground" data-testid="pager-label"><span className="font-medium text-foreground">{st.cur === 0 ? "Page 1" : `Pages ${pageLabel(st.cur)}`}</span> of {pagesOf(st.doc.spreads.length)}</span>
      <IconButton label="Next pages (→)" tooltip={false} size="sm" isDisabled={st.cur >= st.doc.spreads.length - 1} onPress={() => { st.setCur(st.cur + 1); st.setSel([]) }}><ChevronRight /></IconButton>
    </div>
  )
}
export function Toasts({ className }: { className?: string }) {
  const st = useStudio()
  return <ToastRegion queue={st.queue} className={cn("bottom-3 right-3 w-[320px]", className)} />
}

/* ---------------------------------------------------------------- layout */
export function EditorFrame({ top, left, right, dock, canvas, overlay, className }: {
  top?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; dock?: React.ReactNode; canvas: React.ReactNode; overlay?: React.ReactNode; className?: string
}) {
  // v0.7.1: the ONE editor shell. Three surfaces (#E1E1E1 bars, #C8CACB canvas, white paper), no borders.
  // Panels: [ list · \ photos · ] inspector · Cmd/Ctrl+. all. Tab on the bare canvas hides the panels once; the next Tab moves on.
  const st = useStudio()
  const inspectorOpen = useInspectorOpen()
  const pn = { l: !!left && st.panels.l, b: !!dock && st.panels.b, r: !!right && inspectorOpen }
  const pnRef = React.useRef(pn); pnRef.current = pn
  const toggleAll = React.useCallback(() => {
    const p = pnRef.current, any = p.l || p.b || p.r
    st.setPanels({ l: !any, b: !any }); setInspectorOpen(!any)
  }, [st])
  const tabbed = React.useRef(false)
  // v0.9.2/0.9.3: Space arms pan only — suppress focus ring (data-panning) and never toggle panels
  const [spaceDown, setSpaceDown] = React.useState(false)
  const spaceDownRef = React.useRef(false)
  React.useEffect(() => {
    const typing = (el: EventTarget | null) => {
      const t = el as HTMLElement | null
      if (!t?.closest) return false
      if (t.closest("textarea,[contenteditable=true]")) return true
      const input = t.closest("input") as HTMLInputElement | null
      if (!input) return false
      return !["file", "checkbox", "radio", "range", "button", "submit", "color"].includes(input.type)
    }
    const on = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return
      if (e.type === "keydown") {
        e.preventDefault()
        e.stopPropagation()
        spaceDownRef.current = true
        setSpaceDown(true)
      } else {
        spaceDownRef.current = false
        setSpaceDown(false)
      }
    }
    const clear = () => { spaceDownRef.current = false; setSpaceDown(false) }
    // capture: win over button activation / other key handlers
    window.addEventListener("keydown", on, true)
    window.addEventListener("keyup", on, true)
    window.addEventListener("blur", clear)
    return () => { window.removeEventListener("keydown", on, true); window.removeEventListener("keyup", on, true); window.removeEventListener("blur", clear) }
  }, [])
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (spaceDownRef.current || e.code === "Space") return // v0.9.3: Space never toggles panels
      const t = e.target as HTMLElement
      const textIn = t instanceof HTMLInputElement && !["file", "checkbox", "radio", "range", "button", "submit", "color"].includes(t.type)
      if (textIn || t.closest("textarea,select,[contenteditable=true]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === ".") { e.preventDefault(); toggleAll(); return }
      if (mod || e.altKey) return
      if (t.closest("input")) return
      if (e.key === "[" && left) { e.preventDefault(); st.setPanels({ ...st.panels, l: !st.panels.l }) }
      else if (e.key === "\\" && dock) { e.preventDefault(); st.setPanels({ ...st.panels, b: !st.panels.b }) }
      else if ((e.key === "]" || e.key.toLowerCase() === "i") && right) { e.preventDefault(); toggleInspector() }
    }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  }, [left, right, dock, st, toggleAll])
  const panning = spaceDown || st.view.tool === "hand"
  return (
    <div className={cn("e7 relative flex h-full flex-col overflow-hidden", className)} style={{ background: SURROUND, color: T }} data-testid="editor7">
      <style>{V7CSS}</style>
      <div className="relative flex h-full min-h-0 flex-col" data-testid="editor">
        {top}
        <div className="flex min-h-0 flex-1">
          {left && <div className="e7-pan shrink-0 overflow-hidden" style={{ width: pn.l ? 212 : 0 }} aria-hidden={!pn.l || undefined} inert={!pn.l || undefined} data-hidden-panel={!pn.l || undefined} data-testid="panel-l"><div className="h-full w-53">{left}</div></div>}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="e7-canvas relative flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="canvas" tabIndex={0} aria-label="Canvas"
              data-panning={panning || undefined}
              onFocus={(e) => { if (e.target === e.currentTarget) tabbed.current = false }}
              onKeyDown={(e) => {
                // a11y: no keyboard trap. Only a plain Tab on the canvas element itself hides the panels, and only once per visit.
                // v0.9.3: never while Space is held (Space is pan only)
                if (spaceDownRef.current || e.code === "Space") return
                if (e.key !== "Tab" || e.target !== e.currentTarget || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || tabbed.current) return
                tabbed.current = true; e.preventDefault(); toggleAll()
              }}
              onPointerDown={(e) => {
                const t = e.target as HTMLElement
                if (t.closest('[data-testid="spread"],[data-testid="node-view"],button,[role=toolbar],[role=dialog],input')) return
                if (st.sel.length) return
                st.setNode({ k: "none" })
              }}>{canvas}</div>
            {dock && <div className="e7-pan shrink-0 overflow-hidden" style={{ height: pn.b ? undefined : 0 }} aria-hidden={!pn.b || undefined} inert={!pn.b || undefined} data-hidden-panel={!pn.b || undefined} data-testid="panel-b">{dock}</div>}
          </main>
          {right && <div className="e7-pan shrink-0 overflow-hidden" style={{ width: pn.r ? 300 : 0 }} aria-hidden={!pn.r || undefined} inert={!pn.r || undefined} data-hidden-panel={!pn.r || undefined} data-testid="panel-r">
            <div className="e7 scroll-thin h-full w-75 overflow-y-auto overflow-x-hidden" style={{ background: BAR }} data-testid="inspector">{right}</div></div>}
        </div>
        {overlay}
      </div>
    </div>
  )
}
export function ConfirmDialog({ isOpen, onCancel, onConfirm, title, description, confirm = "Remove", destructive = true }: {
  isOpen: boolean; onCancel: () => void; onConfirm: () => void; title: string; description: React.ReactNode; confirm?: string; destructive?: boolean
}) {
  return (
    <AlertDialog isOpen={isOpen} title={title} confirmLabel={confirm} tone={destructive ? "destructive" : "neutral"} onCancel={onCancel} onConfirm={onConfirm}>{description}</AlertDialog>
  )
}
export function SliderMini({ label, value, onChange, min, max, step = 1, className }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; className?: string }) {
  return (
    <Slider aria-label={label} value={value} onChange={(v) => onChange(v as number)} minValue={min} maxValue={max} step={step} className={cn("w-24", className)}>
      <SliderTrack><SliderFillTrack /><SliderThumb /></SliderTrack>
    </Slider>
  )
}

/** v4.1: export dialogs are shown the way they appear in the product — over the editor's spread under a scrim. */
export function DialogBackdrop() {
  const st = useStudio()
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      <MiniSpread s={st.doc.spreads[st.cur] ?? st.doc.spreads[0]} width={760} className="shadow-stage" />
      <div className="absolute inset-0 bg-black/30" />
    </div>
  )
}

/** v0.7.4 (P2-4): the cover's front photo counts as used when it comes from the gallery */
function withCover(set: Set<string>, cov: string, gallery: { id: string }[] | string[]) {
  const ids = (gallery as (string | { id: string })[]).map((g) => typeof g === "string" ? g : g.id)
  if (!ids.includes(cov) || set.has(cov)) return set
  const n = new Set(set); n.add(cov); return n
}

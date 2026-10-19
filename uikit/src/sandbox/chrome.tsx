/* Sandbox editor chrome built from the ported JollyUI parts: top bar, spreads panel, filmstrip dock, status, toasts. */
import * as React from "react"
import { useDragAndDrop, isTextDropItem, isFileDropItem, Button as AriaButton } from "react-aria-components"
import {
  MousePointer2, SquareDashed, Type, Hand, Undo2, Redo2, Magnet, Grid3x3, Eye, Download, ChevronDown, ChevronLeft, ChevronRight,
  PanelLeftClose, Check, AlertTriangle, Plus, Loader2, Images, LayoutTemplate, Layers, BookOpen, Ruler, Filter, ArrowDownUp,
  Crosshair, Scan, X, ImageOff, Upload, CloudOff, MoreHorizontal, Copy, Trash2,
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
import { SW, SH, spread, type Spread } from "./model"
import { ALL_TEMPLATES, TT } from "./templates"
import { metaOf } from "./meta"

export const toolToggle = "size-8 px-0 text-muted-foreground data-[hovered]:bg-accent/70 data-[hovered]:text-foreground data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm dark:data-[selected]:bg-accent [&_svg]:size-4"
export const viewToggle = cn(toolToggle, "data-[selected]:bg-accent data-[selected]:shadow-none dark:data-[selected]:bg-accent")
/* v3: Tabs carry their own geometry (ui/tabs.tsx); these stay as hooks for layout-only overrides */
export const segList = ""
export const segTab = ""
export const floatBar = "rounded-lg border bg-popover p-1 shadow-md"
export const sbtn = "h-8 gap-1.5 px-3 text-[13px] [&_svg]:size-4"

export function AppMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow-xs"><BookOpen className="size-3" /></div>
      {!compact && <span className="text-[14px] font-semibold tracking-[-0.01em]">Photobooks</span>}
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
export function ViewToggle({ k }: { k: ViewKey }) {
  const st = useStudio()
  const [I, l, sc] = VIEW_TOGGLES[k]
  return (
    <TooltipTrigger delay={300}>
      <Toggle aria-label={l} size="sm" isSelected={st.view[k]} onChange={(v) => st.setView({ [k]: v })} className={viewToggle} data-testid={`toggle-${k}`}><I /></Toggle>
      <Tooltip placement="bottom" className="flex items-center gap-2 px-2 py-1 text-xs">{l}{sc && <Kbd className="h-[18px]">{sc}</Kbd>}</Tooltip>
    </TooltipTrigger>
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
      aria-label="Tool" className="gap-0.5 rounded-lg bg-muted p-0.5 dark:bg-black/25">
      {tools.map((id) => {
        const [I, l] = all[id]
        return (
          <TooltipTrigger key={id} delay={300}>
            <Toggle id={id} aria-label={l} size="sm" className={toolToggle}><I /></Toggle>
            <Tooltip placement="bottom" className="px-2 py-1 text-xs">{l}</Tooltip>
          </TooltipTrigger>
        )
      })}
    </ToggleButtonGroup>
  )
}
export function ZoomMenu() {
  const st = useStudio()
  return (
    <MenuTrigger>
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[13px] tabular-nums text-muted-foreground" data-testid="zoom-menu">{st.view.zoom === 1 ? "Fit" : `${Math.round(st.view.zoom * 100)}%`}<ChevronDown className="size-3.5 opacity-50" /></Button>
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

export function TopBar({ tools = true, history = true, views = ["snap", "grid"], zoom = true, save = true, right, center, title = "Summer by the sea", primary = true }: {
  tools?: boolean | ("select" | "frame" | "text" | "hand")[]; history?: boolean; views?: ViewKey[]; zoom?: boolean; save?: boolean
  right?: React.ReactNode; center?: React.ReactNode; title?: string; primary?: boolean
}) {
  return (
    <header className="relative z-10 flex h-(--topbar) shrink-0 items-center gap-2 border-b bg-chrome px-3">
      <AppMark compact />
      <span className="text-base font-light text-border">/</span>
      <MenuTrigger>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-[13px]">{title}<ChevronDown className="size-3.5 opacity-50" /></Button>
        <MenuPopover placement="bottom start" className="w-52">
          <Menu><MenuItem>Rename…</MenuItem><MenuItem>Book settings…</MenuItem><MenuSeparator /><MenuItem>Show in folder</MenuItem></Menu>
        </MenuPopover>
      </MenuTrigger>
      <div className="absolute left-1/2 -translate-x-1/2">
        {center ?? (
          <Toolbar aria-label="Tools" className="items-center gap-1">
            {tools && <ToolGroup tools={Array.isArray(tools) ? tools : undefined} />}
            {tools && (history || views.length > 0) && <Separator orientation="vertical" className="mx-1 h-5" />}
            {history && <HistoryButtons />}
            {history && views.length > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
            {views.map((k) => <ViewToggle key={k} k={k} />)}
          </Toolbar>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {save && <SaveStatus />}
        {save && <Separator orientation="vertical" className="mx-1 h-5" />}
        {zoom && <ZoomMenu />}
        {right ?? (primary && (
          <>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-[13px] shadow-xs [&_svg]:size-4"><Eye />Preview</Button>
            <Button size="sm" className="h-8 gap-1.5 px-2.5 text-[13px] shadow-sm [&_svg]:size-4"><Download />Export</Button>
          </>
        ))}
      </div>
    </header>
  )
}

/* ---------------------------------------------------------------- mini spread (thumbnails) */
export function MiniSpread({ s, width, className }: { s: Spread; width: number; className?: string }) {
  const st = useStudio()
  const sc = width / SW
  const par = s.parent ? st.doc.parents.find((p) => p.id === s.parent) : undefined
  const fr = [...(par?.frames ?? []), ...s.frames]
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/.14)]", className)} style={{ width, height: SH * sc, background: s.bg ?? "var(--paper,#fff)" }}>
      {fr.map((f) => (
        <div key={f.id} className="absolute overflow-hidden" style={{ left: f.x * sc, top: f.y * sc, width: f.w * sc, height: f.h * sc, transform: f.rot ? `rotate(${f.rot}deg)` : undefined }}>
          {f.kind === "text" ? <div className="mt-[30%] h-[2px] w-3/4 rounded bg-black/25" />
            : f.photo && !st.missing.has(f.photo) ? <PhotoImg f={f} wpx={f.w * sc} hpx={f.h * sc} />
            : <div className={cn("size-full", f.photo ? "bg-[repeating-linear-gradient(45deg,#efedea,#efedea_3px,#e4e1dd_3px,#e4e1dd_6px)]" : "border border-dashed border-[#cfcbc5] bg-[#f4f3f1]")} />}
        </div>
      ))}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/10" />
    </div>
  )
}
export function TemplateThumb({ id, width, className, photos: ph }: { id: string; width: number; className?: string; photos?: (string | null)[] }) {
  const t = TT(id)
  return (
    <div className={cn("relative shrink-0 rounded-[3px] bg-paper shadow-[0_0_0_1px_rgb(0_0_0/.08)]", className)} style={{ width, height: width / 2 }}>
      {t.frames.map((b, i) => (
        <div key={i} className="absolute overflow-hidden rounded-[1px] bg-[#d9d5cf]" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}>
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
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 pl-3 pr-1.5">
      {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="heading text-[14px]">{title}</span>
      {meta && <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>}
      <div className="ml-auto flex items-center">{children}</div>
    </div>
  )
}
export function SpreadsPanel({ reorder = false, actions = false, onCollapse }: { reorder?: boolean; actions?: boolean; onCollapse?: () => void }) {
  const st = useStudio()
  const items = st.doc.spreads.map((s, i) => ({ s, i }))
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ "text/plain": String(k) })),
    onReorder(e) {
      const ids = [...e.keys].map(String)
      st.update((d) => {
        const moving = d.spreads.filter((s) => ids.includes(s.id))
        const rest = d.spreads.filter((s) => !ids.includes(s.id))
        let at = rest.findIndex((s) => s.id === String(e.target.key))
        if (e.target.dropPosition === "after") at += 1
        const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
        st.setCur(next.findIndex((s) => s.id === ids[0]))
        return { ...d, spreads: next }
      }, "Reorder spreads")
      st.setStatus(`Moved spread to position ${1 + st.doc.spreads.findIndex((s) => s.id === String(e.target.key))}`)
    },
  })
  return (
    <aside className="flex min-h-0 flex-col border-r bg-chrome" data-testid="spreads-panel">
      <PanelHeader icon={<Layers />} title="Spreads" meta={`${st.doc.spreads.length}`}>
        {onCollapse && <IconButton label="Collapse panel  [" size="sm" onPress={onCollapse}><PanelLeftClose /></IconButton>}
      </PanelHeader>
      <ThumbGrid aria-label="Spreads" selectionMode="single" disallowEmptySelection selectedKeys={[st.doc.spreads[st.cur]?.id]} items={items}
        onSelectionChange={(k) => { const id = [...k][0]; const i = st.doc.spreads.findIndex((s) => s.id === id); if (i >= 0) { st.setCur(i); st.setSel([]) } }}
        dragAndDropHooks={reorder ? dragAndDropHooks : undefined}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-1.5 py-1.5">
        {({ s, i }) => (
          <ThumbItem id={s.id} textValue={`Spread ${i + 1}`}
            className="group/sp flex flex-col gap-1 rounded-lg p-1.5 ring-0! ring-offset-0! data-[hovered]:bg-accent/50 data-[selected]:bg-accent data-[dragging]:opacity-40 data-[drop-target]:outline-2 data-[drop-target]:outline-select">
            {reorder && <AriaButton slot="drag" className="sr-only">Drag spread {i + 1}</AriaButton>}
            <MiniSpread s={s} width={160} className="group-data-[selected]/sp:outline-2 group-data-[selected]/sp:outline-offset-2 group-data-[selected]/sp:outline-select" />
            {actions && <SpreadItemMenu i={i} />}
            <span className="flex text-[11px] tabular-nums text-muted-foreground group-data-[selected]/sp:text-foreground">
              <span className="mr-1.5 w-3 text-right font-medium">{i + 1}</span>{i === 0 ? "Cover" : `${i * 2}–${i * 2 + 1}`}
              {s.frames.some((f) => f.kind === "image" && !f.photo) && <span className="ml-auto text-warning">{s.frames.filter((f) => f.kind === "image" && !f.photo).length} empty</span>}
              {s.frames.some((f) => f.photo && st.missing.has(f.photo)) && <span className="ml-auto text-destructive">missing</span>}
            </span>
          </ThumbItem>
        )}
      </ThumbGrid>
      {actions && <SpreadActions />}
    </aside>
  )
}
function SpreadItemMenu({ i }: { i: number }) {
  const st = useStudio()
  const dup = () => {
    const src = st.doc.spreads[i]
    const copy: Spread = { ...src, id: `s${Date.now()}`, frames: src.frames.map((f) => ({ ...f, id: `${f.id}c${Date.now() % 1000}` })) }
    st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, i + 1), copy, ...d.spreads.slice(i + 1)] }), "Duplicate spread")
    st.setCur(i + 1); st.setStatus(`Spread ${i + 1} duplicated`)
  }
  const del = () => {
    if (st.doc.spreads.length <= 1) return
    st.update((d) => ({ ...d, spreads: d.spreads.filter((_, j) => j !== i) }), "Delete spread")
    st.setCur(Math.max(0, i - 1))
    st.toast({ title: `Spread ${i + 1} deleted`, description: "Its photos are back in the gallery.", action: { label: "Undo", onAction: st.undo } })
  }
  return (
    <MenuTrigger>
      <AriaButton aria-label={`Spread ${i + 1} actions`} className="absolute right-2.5 top-2.5 z-10 grid size-6 place-items-center rounded-md bg-popover/90 text-muted-foreground opacity-0 shadow-sm outline-hidden group-data-[hovered]/sp:opacity-100 group-data-[selected]/sp:opacity-100 data-[focus-visible]:opacity-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring" data-testid="spread-menu"><MoreHorizontal className="size-3.5" /></AriaButton>
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
    <div className="flex items-center gap-1 border-t border-border/70 p-1.5">
      <Button variant="ghost" size="sm" onPress={add} className="h-8 flex-1 justify-start gap-2 px-2 text-[13px] text-muted-foreground [&_svg]:size-4" data-testid="add-spread"><Plus />Add spread</Button>
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
  const placed = placedSet(st.doc)
  let ids = sortable ? sortedGallery(st.doc.gallery, st.view.sort) : st.doc.gallery
  if (st.view.unplacedOnly) ids = ids.filter((id) => !placed.has(id))
  const items = ids.map((id) => P(id)).filter(Boolean)
  const [fileOver, setFileOver] = React.useState(false)
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ [PHOTO_TYPE]: String(k), "text/plain": P(String(k)).name })),
    acceptedDragTypes: [FRAME_TYPE, "image/jpeg", "image/png", "image/webp"],
    getDropOperation: () => "move",
    onDragStart: (e) => { st.setDragging([...e.keys].map(String)); st.setStatus(`Dragging ${e.keys.size} photo${e.keys.size > 1 ? "s" : ""} — drop on a frame${st.features.multiDrop ? ", a spread or between spreads" : ""}`) },
    onDragEnd: () => { st.setDragging(null); setTimeout(() => st.setStatus(""), 2500) },
    onRootDrop: async (e) => {
      setFileOver(false)
      const files = e.items.filter(isFileDropItem)
      if (files.length && externalDrop) {
        const added: Photo[] = []
        for (const f of files) {
          const file = await f.getFile()
          const url = URL.createObjectURL(file)
          const dim = await new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 3000, h: 2000 }); im.src = url })
          const p: Photo = { id: `x${++ext}`, src: url, name: file.name, w: dim.w, h: dim.h, credit: { title: file.name, author: "you", url: "" } }
          photos.push(p); added.push(p)
        }
        st.update((d) => ({ ...d, gallery: [...d.gallery, ...added.map((p) => p.id)] }), `Import ${added.length} photos`)
        st.toast({ tone: "success", icon: <Upload />, title: `Imported ${added.length} photo${added.length > 1 ? "s" : ""}`, description: added.map((p) => p.name).join(", ") })
        return
      }
      for (const it of e.items.filter(isTextDropItem)) {
        if (!it.types.has(FRAME_TYPE)) continue
        const [si, fid] = (await it.getText(FRAME_TYPE)).split(":")
        const ph = st.doc.spreads[Number(si)].frames.find((f) => f.id === fid)?.photo
        st.update((d) => mapSpread(d, Number(si), (s) => ({ ...s, frames: s.frames.map((f) => (f.id === fid ? { ...f, photo: null } : f)) })), "Unplace photo")
        if (ph) st.setStatus(`${P(ph).name} is back in the gallery — the frame is empty`)
      }
    },
    onDropEnter: () => setFileOver(true), onDropExit: () => setFileOver(false),
  })
  React.useEffect(() => {
    if (!removable) return
    const on = (e: KeyboardEvent) => { if ((e.key === "Delete" || e.key === "Backspace") && st.filmSel.length && (e.target as HTMLElement).closest("[data-filmstrip]")) onRemove?.(st.filmSel[0]) }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  }, [removable, st.filmSel, onRemove])
  return (
    <div className="relative" data-filmstrip>
      <ThumbGrid aria-label="Photos" layout="grid" selectionMode="multiple" selectionBehavior="replace" items={items}
        selectedKeys={st.filmSel} onSelectionChange={(k) => st.setFilmSel(k === "all" ? items.map((p) => p.id) : [...k].map(String))}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => <div className="flex h-(--thumb) items-center px-2 text-[13px] text-muted-foreground">{st.view.unplacedOnly ? "Every photo is placed. Turn off “Unplaced” to see all." : "No photos yet — drop files here or add a folder."}</div>}
        className="flex gap-2 overflow-x-auto overflow-y-hidden p-1 pb-2" data-testid="filmstrip">
        {(p) => {
          const h = st.view.thumb
          const w = thumbWidth(p.w, p.h, h) // shared aspect rule (app/ui PhotoThumb): true ratio, clamped 5:8…8:5
          const miss = st.missing.has(p.id)
          return (
            <ThumbItem id={p.id} textValue={p.name} className="group/th shrink-0 overflow-hidden rounded-[5px] shadow-[0_0_0_1px_rgb(0_0_0/.06)] data-[dragging]:opacity-40">
              <AriaButton slot="drag" className="sr-only">Drag {p.name}</AriaButton>
              <div style={{ width: w, height: h }} className="relative">
                {miss ? <div className="grid size-full place-items-center bg-muted text-muted-foreground"><ImageOff className="size-4" /></div>
                  : <img src={p.src} className="size-full object-cover" draggable={false} alt="" />}
                {placed.has(p.id) && <span className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm" title="Placed in the book"><Check className="size-2.5" strokeWidth={3} /></span>}
                {p.lowres && <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-[4px] bg-black/60 px-1 py-px text-[9.5px] font-medium text-white"><AlertTriangle className="size-2.5 text-[#f2c46d]" />Low-res</span>}
                {removable && (
                  <button type="button" aria-label={`Remove ${p.name} from gallery`} onClick={(e) => { e.stopPropagation(); onRemove?.(p.id) }} onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-1 top-1 hidden size-5 place-items-center rounded-full bg-black/60 text-white group-hover/th:grid"><X className="size-3" /></button>
                )}
              </div>
              {h >= 90 && <div className="truncate bg-chrome px-1 py-0.5 text-[10.5px] text-muted-foreground" style={{ width: w }}>{p.name}</div>}
            </ThumbItem>
          )
        }}
      </ThumbGrid>
      {fileOver && externalDrop && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-select bg-select/10 text-[13px] font-medium">Drop to import into the gallery</div>}
    </div>
  )
}
export function Dock({ children, left, right, templates = false, tabs = true, defaultTab = "photos" }: { children?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; templates?: boolean | React.ReactNode; tabs?: boolean; defaultTab?: string }) {
  const st = useStudio()
  const placed = placedSet(st.doc)
  const chip = "h-7 gap-1.5 px-2 text-xs text-muted-foreground [&_svg]:size-3.5 data-[hovered]:bg-accent/70 data-[hovered]:text-foreground data-[selected]:bg-accent data-[selected]:text-foreground"
  return (
    <div className="shrink-0 border-t bg-chrome" data-testid="dock">
      <Tabs defaultSelectedKey={defaultTab} className="gap-0">
        <div className="flex h-10 items-center gap-3 px-3">
          {tabs && (
            <TabList aria-label="Dock" className={segList}>
              <Tab id="photos" className={segTab}><Images />Photos<TabCount>{st.doc.gallery.length}</TabCount></Tab>
              {templates !== false && <Tab id="templates" className={segTab}><LayoutTemplate />Templates</Tab>}
            </TabList>
          )}
          {left ?? <span className="text-xs tabular-nums text-muted-foreground" data-testid="placed-count">{placed.size} of {st.doc.gallery.length} placed</span>}
          <div className="ml-auto flex items-center gap-1">
            {right ?? (
              <>
                <Toggle size="sm" isSelected={st.view.unplacedOnly} onChange={(v) => st.setView({ unplacedOnly: v })} className={chip}><Filter />Unplaced</Toggle>
                <MenuTrigger>
                  <Button variant="ghost" size="sm" className={chip}><ArrowDownUp />{{ date: "Date taken", name: "File name", added: "Added order" }[st.view.sort]}</Button>
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
        <TabPanel id="photos" className="mt-0 px-2 pb-1">{children ?? <Filmstrip />}</TabPanel>
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
        className="flex gap-2.5 overflow-x-auto p-1 pb-2" data-testid="template-bar">
        {(t) => (
          <ThumbItem id={t.id} textValue={t.name} className="flex shrink-0 flex-col gap-1 rounded-[4px]">
            <TemplateThumb id={t.id} width={92} />
            <span className="w-[92px] truncate text-[10.5px] text-muted-foreground">{t.name}</span>
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
  return <div className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-[60%] truncate rounded-md bg-popover/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm empty:hidden" role="status" aria-live="polite" data-testid="status">{st.status}</div>
}
export function Pager() {
  const st = useStudio()
  return (
    <div className={cn(floatBar, "absolute bottom-3 right-3 z-30 flex items-center gap-0.5 px-0.5 py-0.5 text-xs")}>
      <IconButton label="Previous spread (←)" tooltip={false} size="sm" isDisabled={st.cur === 0} onPress={() => { st.setCur(st.cur - 1); st.setSel([]) }}><ChevronLeft /></IconButton>
      <span className="px-1 tabular-nums text-muted-foreground"><span className="font-medium text-foreground">Spread {st.cur + 1}</span> of {st.doc.spreads.length}</span>
      <IconButton label="Next spread (→)" tooltip={false} size="sm" isDisabled={st.cur >= st.doc.spreads.length - 1} onPress={() => { st.setCur(st.cur + 1); st.setSel([]) }}><ChevronRight /></IconButton>
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
  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-chrome", className)} data-testid="editor">
      {top}
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${left ? "var(--panel-left)" : ""} minmax(0,1fr) ${right ? "var(--panel-right)" : ""}` }}>
        {left}
        <main className="relative flex min-h-0 min-w-0 flex-col">{canvas}{dock}</main>
        {right}
      </div>
      {overlay}
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
      <SliderTrack className="h-1 bg-secondary dark:bg-accent"><SliderFillTrack /><SliderThumb className="top-1/2 size-3.5 border-[1.5px] shadow-xs" /></SliderTrack>
    </Slider>
  )
}

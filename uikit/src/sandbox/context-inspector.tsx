/* proto (designer-proto-2): contextual inspector. Content follows the selection:
   nothing → Spread · one image → Photo · one text → Text · several → Multiple.
   Frequent controls first; rare ones start folded (SectionsCollapsed). Cards are reusable kit-style sections. */
import * as React from "react"
import { PanelRightClose, Search, Plus, MoreHorizontal, Pencil, Trash2, Copy, Sparkles, LayoutTemplate, Image as ImageIcon, Type, Layers, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabList, Tab } from "@/components/ui/tabs"
import { SearchField, SearchFieldInput, SearchFieldClear, SearchFieldGroup } from "@/components/ui/searchfield"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { IconButton, Section, SectionsCollapsed } from "@/components/app/ui"
import type { Template } from "@/data"
import { useStudio } from "./store"
import { segList, segTab, TemplateThumb, applyTemplate } from "./chrome"
import { PhotoSection, CropSection, PhotoRotateSection, AdjustSection, CaptionSection, GeometrySection, ArrangeSection, AlignSection, DeleteFrameButton } from "./inspector"
import { SpreadBgSection, TextSection, FrameStyleSection } from "./sections"
import { ALL_TEMPLATES, slotCount, setTemplatePreview, useCustomTemplates, addCustom, renameCustom, duplicateCustom, deleteCustom, nextCustomName } from "./templates"
import { setInspectorOpen } from "./inspectorState"
import { SW, SH, effectiveGrid, type Spread, type Grid } from "./model"
import { TT } from "./templates"
import { SliderRow, Segmented } from "@/components/app/controls"
import { mapSpread } from "./store"
import { BookInspector, pageLabel, GridFields, SegC, Toggle, useMasters } from "./v7"

type Ctx = "spread" | "photo" | "text" | "multi"
const META: Record<Ctx, { title: string; icon: React.ReactNode }> = {
  spread: { title: "Spread", icon: <BookOpen /> }, photo: { title: "Photo", icon: <ImageIcon /> },
  text: { title: "Text", icon: <Type /> }, multi: { title: "Multiple selection", icon: <Layers /> },
}

/** Reusable inspector shell: context header (icon + title + meta + collapse) and a scrolling body of sections. */
export function InspectorShell({ ctx, meta, children }: { ctx: Ctx; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col" data-testid="ctx-inspector" data-ctx={ctx}>
      <div className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2" data-testid="inspector-header">
        <span className="text-muted-foreground [&_svg]:size-4">{META[ctx].icon}</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <h2 className="truncate text-sm font-semibold">{META[ctx].title}</h2>
          {meta && <span className="truncate text-2xs text-muted-foreground" data-testid="inspector-meta">{meta}</span>}
        </div>
        <IconButton label="Hide inspector (I)" size="sm" className="ml-auto" onPress={() => setInspectorOpen(false)}><PanelRightClose /></IconButton>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  )
}

export function ContextInspector() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const sel = s.frames.filter((f) => st.sel.includes(f.id))
  const ctx: Ctx = sel.length === 0 ? "spread" : sel.length > 1 ? "multi" : sel[0].kind === "text" ? "text" : "photo"
  React.useEffect(() => () => setTemplatePreview(null), [])
  if (st.node) return <BookInspector />
  if (ctx === "spread") {
    const empty = s.frames.filter((f) => f.kind === "image" && !f.photo).length
    return (
      <InspectorShell ctx="spread" meta={`${st.cur === 0 ? "Page 1" : `Pages ${pageLabel(st.cur)}`} · ${empty} empty`}>
        <LayoutSection />
        <SpreadPageSection />
        <SpreadBgSection />
        <SpreadGridSection />
      </InspectorShell>
    )
  }
  if (ctx === "photo") return (
    <InspectorShell ctx="photo">
      <PhotoSection />
      <CropSection />
      <PhotoRotateSection />
      <SectionsCollapsed><AdjustSection /><CaptionSection /><GeometrySection /><FrameStyleSection /><ArrangeSection /></SectionsCollapsed>
      <div className="p-4"><DeleteFrameButton /></div>
    </InspectorShell>
  )
  if (ctx === "text") return (
    <InspectorShell ctx="text">
      <TextSection live />
      <SectionsCollapsed><GeometrySection /><ArrangeSection /></SectionsCollapsed>
      <div className="p-4"><DeleteFrameButton /></div>
    </InspectorShell>
  )
  const imgs = sel.filter((f) => f.kind === "image").length
  return (
    <InspectorShell ctx="multi" meta={`${sel.length} items · ${imgs} photo${imgs === 1 ? "" : "s"}, ${sel.length - imgs} text`}>
      <AlignSection />
      <ArrangeSection />
      <div className="p-4"><DeleteFrameButton /></div>
    </InspectorShell>
  )
}

/* ----------------------------------------------------------------- Layout (templates) */
const CHIPS = [["all", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4+"]] as const
const matches = (t: Template, chip: string) => chip === "all" || (chip === "4" ? slotCount(t) >= 4 : slotCount(t) === +chip)

function TemplateTile({ t, onApply, custom, current, renaming, onStartRename, onEndRename, onDuplicate, onDelete }: {
  t: Template; onApply: () => void; custom?: boolean; current?: boolean
  renaming?: boolean; onStartRename?: () => void; onEndRename?: (name: string | null) => void; onDuplicate?: () => void; onDelete?: () => void
}) {
  return (
    <div className="group relative min-w-0" data-testid="tpl-tile" data-tid={t.id}>
      <button type="button" onClick={onApply} onMouseEnter={() => setTemplatePreview(t.id)} onMouseLeave={() => setTemplatePreview(null)}
        onFocus={() => setTemplatePreview(t.id)} onBlur={() => setTemplatePreview(null)} aria-label={`Apply layout ${t.name}`} title={`${t.name} · ${slotCount(t)} photo${slotCount(t) === 1 ? "" : "s"} — hover to preview, click to apply`}
        className={cn("block w-full rounded-md p-1 text-left outline-none transition-colors hover:bg-field focus-visible:ring-2 focus-visible:ring-ring", current && "bg-sel")}>
        <TemplateThumb id={t.id} width={74} className="mx-auto w-full! h-auto! aspect-[2/1]" />
        {!renaming && <div className={cn("mt-1 line-clamp-2 text-2xs leading-snug text-muted-foreground group-hover:text-foreground", current && "font-semibold text-foreground")} title={t.name} data-testid="tpl-name">{t.name}</div>}
      </button>
      {renaming && (
        <input autoFocus defaultValue={t.name} aria-label="Template name" data-testid="tpl-rename-input" onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { if (e.key === "Enter") onEndRename?.(e.currentTarget.value); else if (e.key === "Escape") { e.stopPropagation(); onEndRename?.(null) } }}
          onBlur={(e) => onEndRename?.(e.currentTarget.value)}
          className="mt-1 h-5 w-full rounded-xs bg-field px-1 text-2xs text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
      )}
      {custom && !renaming && (
        <MenuTrigger>
          <IconButton label={`${t.name} options`} size="sm" className="absolute right-1.5 top-1.5 size-6 bg-popover/90 opacity-0 shadow-xs group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100" data-testid="tpl-menu"><MoreHorizontal /></IconButton>
          <MenuPopover placement="bottom end" className="w-44">
            <Menu aria-label={`${t.name} options`}>
              <MenuItem onAction={onStartRename} data-testid="tpl-rename"><Pencil />Rename…</MenuItem>
              <MenuItem onAction={onDuplicate} data-testid="tpl-duplicate"><Copy />Duplicate</MenuItem>
              <MenuSeparator />
              <MenuItem onAction={onDelete} variant="destructive"><Trash2 />Delete</MenuItem>
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      )}
    </div>
  )
}

export function LayoutSection() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const mine = useCustomTemplates()
  const [tab, setTab] = React.useState<"all" | "mine">("all")
  const [chip, setChip] = React.useState<string>("all")
  const [q, setQ] = React.useState("")
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const photos = s.frames.filter((f) => f.kind === "image" && f.photo).length || s.frames.filter((f) => f.kind === "image").length
  const all = [...ALL_TEMPLATES, ...mine]
  const pool = tab === "mine" ? mine : all
  const list = pool.filter((t) => matches(t, chip) && t.name.toLowerCase().includes(q.trim().toLowerCase()))
  const suggested = tab === "all" && chip === "all" && !q ? ALL_TEMPLATES.filter((t) => slotCount(t) === photos && t.id !== s.template).slice(0, 3) : []
  const apply = (id: string) => { setTemplatePreview(null); applyTemplate(st, id) }
  const save = () => {
    const frames = s.frames.filter((f) => f.kind === "image").map((f) => ({ x: f.x / SW * 100, y: f.y / SH * 100, w: f.w / SW * 100, h: f.h / SH * 100 }))
    if (!frames.length) { st.setStatus("Nothing to save — the spread has no photo frames"); return }
    const t = addCustom(nextCustomName(), frames)
    setTab("mine"); setChip("all"); setQ(""); setRenaming(t.id); st.setStatus(`Saved “${t.name}” to My templates`)
  }
  const isMine = (id: string) => mine.some((t) => t.id === id)
  const grid = (ts: Template[]) => (
    <div className="grid grid-cols-2 gap-1.5">
      {ts.map((t) => <TemplateTile key={t.id} t={t} current={t.id === s.template} onApply={() => apply(t.id)} custom={isMine(t.id)}
        renaming={renaming === t.id} onStartRename={() => setRenaming(t.id)}
        onEndRename={(n) => { if (n !== null && n.trim() && n.trim() !== t.name) { renameCustom(t.id, n); st.setStatus(`Renamed to “${n.trim()}”`) } setRenaming(null) }}
        onDuplicate={() => { const d = duplicateCustom(t.id); if (d) st.setStatus(`Duplicated as “${d.name}”`) }}
        onDelete={() => { deleteCustom(t.id); st.setStatus(`Deleted “${t.name}”`) }} />)}
    </div>
  )
  const curName = all.find((t) => t.id === s.template)?.name
  return (
    <Section title="Layout" summary={curName} right={<IconButton label="Save as template" size="sm" onPress={save} data-testid="tpl-save"><Plus /></IconButton>}>
      <div className="flex flex-col gap-3" data-testid="layout-section">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as "all")}>
          <TabList aria-label="Template source" className={cn(segList, "grid grid-cols-2")}>
            <Tab id="all" className={segTab}>All <span className="ml-1 text-muted-foreground">{all.length}</span></Tab>
            <Tab id="mine" className={segTab} data-testid="tab-mine">My templates <span className="ml-1 text-muted-foreground">{mine.length}</span></Tab>
          </TabList>
        </Tabs>
        <SearchField aria-label="Search layouts" value={q} onChange={setQ}>
          <SearchFieldGroup className="h-8"><Search aria-hidden className="size-3.5 text-muted-foreground" /><SearchFieldInput placeholder="Search layouts" /><SearchFieldClear /></SearchFieldGroup>
        </SearchField>
        <div className="flex items-center gap-1" role="group" aria-label="Photos per layout" data-testid="tpl-chips">
          <span className="mr-1 text-2xs text-muted-foreground">Photos</span>
          {CHIPS.map(([id, l]) => (
            <button key={id} type="button" aria-pressed={chip === id} onClick={() => setChip(id)} data-chip={id}
              className={cn("h-6 min-w-7 rounded-full bg-field px-2 text-xs transition-colors", chip === id ? "bg-sel font-semibold text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{l}</button>
          ))}
        </div>
        {suggested.length > 0 && (
          <div data-testid="tpl-suggested">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Sparkles className="size-3.5 text-muted-foreground" />Suggested for {photos} photo{photos === 1 ? "" : "s"}</div>
            {grid(suggested)}
          </div>
        )}
        <div>
          {suggested.length > 0 && <div className="mb-1.5 text-xs font-medium">All layouts</div>}
          {list.length ? grid(list) : (
            <div className="rounded-md bg-field/60 p-4 text-center text-xs text-muted-foreground" data-testid="tpl-empty">
              <LayoutTemplate className="mx-auto mb-1.5 size-4" />{tab === "mine" && !q && chip === "all" ? "No templates yet. Save a spread you like." : "No layouts match."}
            </div>
          )}
        </div>
        <p className="text-2xs text-muted-foreground" data-testid="tpl-hint">Hover a layout to preview it on the spread; click to apply. Photos are kept in order.</p>
        <Button variant="secondary" size="sm" onPress={save} className="w-full" data-testid="tpl-save-button"><Plus />Save as template</Button>
      </div>
    </Section>
  )
}

/* v0.7.2 (P1-5): spec spread params — margin / gap re-flow the layout; Master picks the master page */
export function relayout(sp: Spread, margin: number, gap: number): Spread {
  if (!sp.template) return { ...sp, margin, gap }
  const boxes = TT(sp.template).frames
  const iw = SW - 2 * margin, ih = SH - 2 * margin
  const frames = sp.frames.map((f, i) => {
    const b = boxes[i]
    if (!b || f.kind !== "image") return f
    return { ...f, x: margin + (b.x / 100) * iw + gap / 2, y: margin + (b.y / 100) * ih + gap / 2, w: Math.max(4, (b.w / 100) * iw - gap), h: Math.max(4, (b.h / 100) * ih - gap) }
  })
  return { ...sp, frames, margin, gap }
}
/** v0.8 §3.4: per-spread grid — "Use master" (inherit) or Custom (own copy, editable). The view toggle only shows/hides it. */
function SpreadGridSection() {
  const st = useStudio(); useMasters()
  const [link, setLink] = React.useState(false)
  const sp = st.doc.spreads[st.cur]
  if (!sp) return null
  const custom = !!sp.grid && Object.keys(sp.grid).length > 0
  const { src: _src, ...g } = effectiveGrid(st.doc, sp)
  const mName = sp.master === "none" ? "Book grid" : `Master ${sp.master ?? "A"}`
  return (
    <Section title="Grid" summary={`${g.cols}×${g.rows}`}>
      <div data-testid="spread-grid">
        <SegC items={[`Use ${sp.master === "none" ? "book" : "master"}`, "Custom"]} on={custom ? 1 : 0}
          set={(i) => st.update((d) => mapSpread(d, st.cur, (x) => ({ ...x, grid: i ? { ...g } : undefined })), i ? "Custom spread grid" : "Use master grid")} />
        <div className="mt-3">
          {custom ? <GridFields g={g as Grid} tid="spread-grid" link={link} setLink={setLink} set={(ng) => st.update((d) => mapSpread(d, st.cur, (x) => ({ ...x, grid: ng })), "Spread grid", `sgrid-${sp.id}`)} />
            : <div className="text-sm text-muted-foreground" data-testid="spread-grid-inherit">{mName} · {g.cols} × {g.rows} · gutter {g.colGutter} mm · margins {g.top}/{g.bottom}/{g.inside}/{g.outside} mm</div>}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Show grid</span><Toggle label="Show grid" on={st.view.grid} onClick={() => st.setView({ grid: !st.view.grid })} /></div>
      </div>
    </Section>
  )
}

function SpreadPageSection() {
  const st = useStudio()
  const sp = st.doc.spreads[st.cur]
  if (!sp) return null
  const m = sp.margin ?? 0, g = sp.gap ?? 0
  const set = (mm: number, gg: number, label: string, key: string) => st.update((d) => mapSpread(d, st.cur, (x) => relayout(x, mm, gg)), label, key)
  return (
    <Section title="Master & spacing">
      <Segmented label="Master" size="sm" value={sp.master ?? "A"} onChange={(v) => st.update((d) => mapSpread(d, st.cur, (x) => ({ ...x, master: v as Spread["master"] })), "Apply master")}
        items={[{ id: "A", label: "Master A" }, { id: "B", label: "Master B" }, { id: "none", label: "None" }]} />
      <div data-testid="spread-spacing">
        <SliderRow label="Margin" resetValue={0} value={m} onChange={(v) => set(v as number, g, "Spread margin", `sm-${sp.id}`)} minValue={0} maxValue={30} step={1}
          formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} className="mt-3" />
        <SliderRow label="Gap" resetValue={0} value={g} onChange={(v) => set(m, v as number, "Spread gap", `sg-${sp.id}`)} minValue={0} maxValue={20} step={1}
          formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} className="mt-2" />
      </div>
      {!sp.template && <div className="mt-1.5 text-xs text-muted-foreground">Margin and gap re-flow template layouts</div>}
    </Section>
  )
}

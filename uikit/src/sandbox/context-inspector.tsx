/* proto (designer-proto-2): contextual inspector. Content follows the selection:
   nothing → Spread · one image → Photo · one text → Text · several → Multiple.
   Frequent controls first; rare ones start folded (SectionsCollapsed). Cards are reusable kit-style sections. */
import * as React from "react"
import { Plus, MoreHorizontal, Pencil, Trash2, Copy, LayoutTemplate, Image as ImageIcon, Type, Layers, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabList, Tab } from "@/components/ui/tabs"
import { NumberField, NumberFieldInput } from "@/components/ui/numberfield"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { IconButton, Section, SectionsCollapsed } from "@/components/app/ui"
import type { Template } from "@/data"
import { useStudio } from "./store"
import { segList, segTab, applyTemplate } from "./chrome"
import { PhotoSection, CropSection, PhotoRotateSection, AdjustSection, CaptionSection, GeometrySection, ArrangeSection, AlignSection, DeleteFrameButton } from "./inspector"
import { SpreadBgSection, TextSection, FrameStyleSection } from "./sections"
import { slotCount, setTemplatePreview, useCustomTemplates, addCustom, renameCustom, duplicateCustom, deleteCustom, nextCustomName, pickerTemplates, pickerAlias, sortByPhotoCount, pageId } from "./templates"
import { PAGE, SW, SH, effectiveGrid, masterKeyOf, defaultMasterOf, masterStatus, type Spread, type Grid } from "./model"
import { TT } from "./templates"
import { SliderRow } from "@/components/app/controls"
import { mapSpread } from "./store"
import { useTextOverflow } from "./text-overflow"
import { BookInspector, pageLabel, GridFields, SegC, Toggle, useMasters, FIELD, SUB, T } from "./v7"

type Ctx = "spread" | "photo" | "text" | "multi"
const META: Record<Ctx, { title: string; icon: React.ReactNode }> = {
  spread: { title: "Spread", icon: <BookOpen /> }, photo: { title: "Photo", icon: <ImageIcon /> },
  text: { title: "Text", icon: <Type /> }, multi: { title: "Multiple selection", icon: <Layers /> },
}

/** Reusable inspector shell: context header (icon + title + meta) and a scrolling body of sections.
    kit-sync KS6 (M54): no Hide inspector button here — the top-bar toggle (I) owns it. */
export function InspectorShell({ ctx, meta, children }: { ctx: Ctx; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col" data-testid="ctx-inspector" data-ctx={ctx}>
      <div className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2" data-testid="inspector-header">
        <span className="text-muted-foreground [&_svg]:size-4">{META[ctx].icon}</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <h2 className="truncate text-sm font-semibold">{META[ctx].title}</h2>
          {meta && <span className="truncate text-2xs text-muted-foreground" data-testid="inspector-meta">{meta}</span>}
        </div>
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
  const overflow = useTextOverflow(ctx === "text" ? sel[0].id : undefined)
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
    <InspectorShell ctx="text" meta={overflow ? <span className="text-ink-warning">Text overflows the frame</span> : undefined}>
      <TextSection live />
      <SectionsCollapsed><GeometrySection /><ArrangeSection /></SectionsCollapsed>
      <div className="p-4"><DeleteFrameButton /></div>
    </InspectorShell>
  )
  // multi-select Spec meta rule: "N frames · " + the non-zero parts of photos / empty / text
  const photos = sel.filter((f) => f.kind === "image" && f.photo).length, texts = sel.filter((f) => f.kind === "text").length, empty = sel.length - photos - texts
  const parts = [photos ? `${photos} photo${photos === 1 ? "" : "s"}` : "", empty ? `${empty} empty` : "", texts ? `${texts} text` : ""].filter(Boolean)
  return (
    <InspectorShell ctx="multi" meta={`${sel.length} frames · ${parts.join(", ")}`}>
      <AlignSection />
      <ArrangeSection />
      <div className="p-4"><DeleteFrameButton /></div>
    </InspectorShell>
  )
}

/* ----------------------------------------------------------------- Layout (templates) */
const CHIPS = [["all", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4+"]] as const
/** contact-sheet ids are t-cs-<c>x<r> with one digit per axis */
const CONTACT_MAX = 6
const matches = (t: Template, chip: string, single: boolean) => chip === "all" || (chip === "4" ? slotCount(t, single) >= 4 : slotCount(t, single) === +chip)

/* Owner 2026-11-02 (layout-tile-states; prod twin: src/editor/layoutThumb.ts, keep the numbers in step):
   the thumb box takes the trim aspect clamped to 2:3…2:1 and the paper fills it;
   page 1 is a single page (the right half of spread 0), so its trim is PAGE × SH and its grid goes 3 columns below 1.2:1 */
const trimRatio = (single: boolean) => (single ? PAGE / SH : SW / SH)
const thumbAspect = (r: number) => Math.min(2, Math.max(2 / 3, r))
const thumbColumns = (r: number) => (r < 1.2 ? 3 : 2)
const pct = (v: number) => `${v}%`
/** kit-sync KS7: a single page draws, previews and applies the page variant of a template (templates.ts pageFrames) */
const onPage = (id: string, single: boolean) => (single ? pageId(id) : id)
function paperBox(r: number) {
  const k = r / thumbAspect(r), w = 100 * Math.min(1, k), h = 100 * Math.min(1, 1 / k)
  return { left: pct((100 - w) / 2), top: pct((100 - h) / 2), width: pct(w), height: pct(h) }
}

/** Layout tile thumb: the paper in a trim-shaped box; tile states ring the paper (state classes come from the tile). */
function LayoutThumb({ id, single, className }: { id: string; single: boolean; className?: string }) {
  const r = trimRatio(single)
  return (
    <div className="relative w-full" style={{ aspectRatio: thumbAspect(r) }} data-testid="tpl-thumb">
      <div className={cn("absolute overflow-hidden rounded-2xs bg-paper shadow-hairline transition-[box-shadow,translate] duration-(--duration-fast)", className)} style={paperBox(r)} data-testid="tpl-paper">
        {TT(onPage(id, single)).frames.map((b, i) => (
          <div key={i} className="absolute overflow-hidden rounded-2xs bg-placeholder-block"
            style={single ? { left: pct(2 * b.x - 100), top: pct(b.y), width: pct(2 * b.w), height: pct(b.h) } : { left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) }} />
        ))}
        {!single && <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />}
      </div>
    </div>
  )
}

function TemplateTile({ t, onApply, single, custom, current, renaming, onStartRename, onEndRename, onDuplicate, onDelete }: {
  t: Template; onApply: () => void; single: boolean; custom?: boolean; current?: boolean
  renaming?: boolean; onStartRename?: () => void; onEndRename?: (name: string | null) => void; onDuplicate?: () => void; onDelete?: () => void
}) {
  return (
    <div className="group relative min-w-0 self-start" data-testid="tpl-tile" data-tid={t.id}>
      <button type="button" onClick={onApply} onMouseEnter={() => setTemplatePreview(onPage(t.id, single))} onMouseLeave={() => setTemplatePreview(null)}
        onFocus={() => setTemplatePreview(onPage(t.id, single))} onBlur={() => setTemplatePreview(null)} aria-label={`Apply layout ${t.name}`} aria-pressed={!!current} title={t.name}
        className="group/tile block w-full rounded-md p-1 text-left outline-none">
        <LayoutThumb id={t.id} single={single} className={cn(current ? "shadow-tile-select" : "group-hover/tile:-translate-y-px group-hover/tile:shadow-tile-hover", "group-focus-visible/tile:shadow-tile-focus")} />
        {/* kit-sync KS7 (Owner 2026-11-02): builtins carry no caption, the name is the tooltip; saved templates keep theirs */}
        {custom && !renaming && <div className={cn("mt-1 line-clamp-2 text-2xs leading-snug text-muted-foreground group-hover:text-foreground", current && "font-semibold text-foreground")} title={t.name} data-testid="tpl-name">{t.name}</div>}
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
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [cols, setCols] = React.useState(3)
  const [rows, setRows] = React.useState(2)
  const single = st.cur === 0
  /* kit-sync KS7 (Owner 2026-11-02, prod LayoutSection): no search / Suggested, one list by photo count */
  const all = [...pickerTemplates(single), ...mine]
  const list = sortByPhotoCount((tab === "mine" ? mine : all).filter((t) => matches(t, chip, single)), single)
  const current = pickerAlias(s.template, single)
  const apply = (id: string) => { setTemplatePreview(null); applyTemplate(st, onPage(id, single)) }
  const save = () => {
    const frames = s.frames.filter((f) => f.kind === "image").map((f) => ({ x: f.x / SW * 100, y: f.y / SH * 100, w: f.w / SW * 100, h: f.h / SH * 100 }))
    if (!frames.length) { st.setStatus("Nothing to save — the spread has no photo frames"); return }
    const t = addCustom(nextCustomName(), frames)
    setTab("mine"); setChip("all"); setRenaming(t.id); st.setStatus(`Saved “${t.name}” to My templates`)
  }
  const isMine = (id: string) => mine.some((t) => t.id === id)
  const grid = (ts: Template[]) => (
    <div className={cn("grid gap-1.5", thumbColumns(trimRatio(single)) === 3 ? "grid-cols-3" : "grid-cols-2")} data-testid="tpl-grid">
      {ts.map((t) => <TemplateTile key={t.id} t={t} single={single} current={t.id === current} onApply={() => apply(t.id)} custom={isMine(t.id)}
        renaming={renaming === t.id} onStartRename={() => setRenaming(t.id)}
        onEndRename={(n) => { if (n !== null && n.trim() && n.trim() !== t.name) { renameCustom(t.id, n); st.setStatus(`Renamed to “${n.trim()}”`) } setRenaming(null) }}
        onDuplicate={() => { const d = duplicateCustom(t.id); if (d) st.setStatus(`Duplicated as “${d.name}”`) }}
        onDelete={() => { deleteCustom(t.id); st.setStatus(`Deleted “${t.name}”`) }} />)}
    </div>
  )
  const curName = current ? (all.find((t) => t.id === current) ?? TT(current)).name : undefined
  const count = (label: string, value: number, set: (n: number) => void, tid: string) => (
    <NumberField aria-label={label} value={value} minValue={1} maxValue={CONTACT_MAX} step={1} onChange={(n) => { if (!Number.isNaN(n)) set(n) }} className="w-11">
      <NumberFieldInput data-testid={tid} className="h-8 w-full flex-none rounded-sm px-2 text-center text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-muted-foreground" />
    </NumberField>
  )
  return (
    <Section title="Layout" note={curName} right={<IconButton label="Save as template" size="sm" onPress={save} data-testid="tpl-save"><Plus /></IconButton>}>
      <div className="flex flex-col gap-3" data-testid="layout-section">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as "all")}>
          <TabList aria-label="Template source" className={cn(segList, "grid grid-cols-2")}>
            {/* r15 M87: label + count in ONE flex item so the single space survives (prod `My templates <span>N</span>`) */}
            <Tab id="all" className={segTab}><span>All <span className="text-muted-foreground">{all.length}</span></span></Tab>
            <Tab id="mine" className={segTab} data-testid="tab-mine"><span>My templates <span className="text-muted-foreground">{mine.length}</span></span></Tab>
          </TabList>
        </Tabs>
        <div className="flex items-center gap-1" role="group" aria-label="Photos per layout" data-testid="tpl-chips">
          <span className="mr-1 text-2xs text-muted-foreground">Photos</span>
          {CHIPS.map(([id, l]) => (
            <button key={id} type="button" aria-pressed={chip === id} onClick={() => setChip(id)} data-chip={id}
              className={cn("h-6 min-w-7 rounded-full bg-field px-2 text-xs leading-[normal] transition-colors", chip === id ? "bg-sel font-semibold text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{l}</button>
          ))}
        </div>
        {list.length ? grid(list) : (
          <div className="rounded-md bg-field/60 p-4 text-center text-xs text-muted-foreground" data-testid="tpl-empty">
            <LayoutTemplate className="mx-auto mb-1.5 size-4" />{chip === "all" ? "No templates yet. Save a spread you like." : "No layouts match."}
          </div>
        )}
        <p className="text-2xs text-muted-foreground" data-testid="tpl-hint">Hover a layout to preview it on the spread; click to apply. Photos are kept in order.</p>
        <Button variant="secondary" size="sm" onPress={save} className="w-full shadow-xs [&_svg]:size-3.5" data-testid="tpl-save-button"><Plus />Save as template</Button>
        {/* kit-sync KS7 (prod LayoutSection contact sheet): Columns × Rows, then apply */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Contact sheet" data-testid="tpl-contact">
          {count("Columns", cols, setCols, "tpl-contact-cols")}
          <span className="text-xs text-muted-foreground" aria-hidden>×</span>
          {count("Rows", rows, setRows, "tpl-contact-rows")}
          <Button variant="secondary" size="sm" className="ml-auto shadow-xs" onPress={() => apply(`t-cs-${cols}x${rows}`)} data-testid="tpl-contact-apply">Contact sheet</Button>
        </div>
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
const MARGIN_KEYS: (keyof Grid)[] = ["top", "bottom", "inside", "outside"]
/** v0.8 §3.4 + layout-grids-parent-inherit GP2–GP6: per-spread grid — "Use master" (inherit) or Custom (per-field overrides on top of the master:
    grey = follows the master, dark + ↺ = set on this spread). Custom alone writes nothing; ↺ deletes one key (all four margins while linked).
    GP5 link on: GridFields' link button calls `set` (→ `write`) with B/I/O = T, so only the margins ≠ T become overrides, one step (prod `linkMarginsPatch`). */
function SpreadGridSection() {
  const st = useStudio(); useMasters()
  const [customFor, setCustomFor] = React.useState<string | null>(null)
  const [linkFor, setLinkFor] = React.useState<{ id: string; on: boolean } | null>(null)
  const sp = st.doc.spreads[st.cur]
  if (!sp) return null
  const { src, ...g } = effectiveGrid(st.doc, sp)
  const custom = (!!sp.grid && Object.keys(sp.grid).length > 0) || customFor === sp.id
  const mk = masterKeyOf(st.doc, sp), none = mk === "none", mName = none ? "Book grid" : `Master ${mk}`
  const link = linkFor?.id === sp.id ? linkFor.on : g.top === g.bottom && g.top === g.inside && g.top === g.outside
  const write = (ng: Grid) => {
    const changed = (Object.keys(ng) as (keyof Grid)[]).filter((k) => ng[k] !== g[k])
    if (changed.length) st.update((d) => mapSpread(d, st.cur, (x) => ({ ...x, grid: { ...x.grid, ...Object.fromEntries(changed.map((k) => [k, ng[k]])) } })), "Spread grid", `sgrid-${sp.id}`)
  }
  const reset = (k: keyof Grid) => {
    const keys = link && MARGIN_KEYS.includes(k) ? MARGIN_KEYS : [k]
    setCustomFor(sp.id)
    st.update((d) => mapSpread(d, st.cur, (x) => { const rest = Object.fromEntries(Object.entries(x.grid ?? {}).filter(([key]) => !keys.includes(key as keyof Grid))); return { ...x, grid: Object.keys(rest).length ? rest : undefined } }), "Reset grid value")
  }
  return (
    <Section title="Grid" summary={`${g.cols}×${g.rows}`}>
      <div data-testid="spread-grid">
        <SegC items={[`Use ${none ? "book" : "master"}`, "Custom"]} on={custom ? 1 : 0}
          set={(i) => { setCustomFor(i ? sp.id : null); if (!i) st.update((d) => mapSpread(d, st.cur, (x) => ({ ...x, grid: undefined })), "Use master grid") }} />
        <div className="mt-3">
          {custom ? <>
            <GridFields g={g as Grid} tid="spread-grid" link={link} setLink={(on) => setLinkFor({ id: sp.id, on })} set={write} src={src} parentName={none ? "book grid" : mName} onReset={reset} />
            <div className="mt-1.5 text-2xs leading-4 text-muted-foreground" data-testid="spread-grid-hint">Grey values follow {none ? "the book grid" : mName}.</div></>
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
  const m = sp.margin ?? 0, g = sp.gap ?? 0, k = masterKeyOf(st.doc, sp), def = defaultMasterOf(st.doc)
  const set =(mm: number, gg: number, label: string, key: string) => st.update((d) => mapSpread(d, st.cur, (x) => relayout(x, mm, gg)), label, key)
  return (
    <Section title="Master & spacing">
      {/* default-master (Owner amendment): always the Cover inspector select, masters in book order + None; picking the default drops `master` (follows it) */}
      <select aria-label="Master" data-testid="spread-master-select" value={k} onChange={(e) => { const v = e.target.value as "A" | "B" | "none"; st.update((d) => mapSpread(d, st.cur, (x) => { const { master: _, ...rest } = x; return v === def ? rest : { ...rest, master: v } }), "Apply master") }}
        className="e7-csel h-9 w-full rounded-md border-0 text-sm outline-none" style={{ backgroundColor: FIELD, color: T }}>
        {(["A", "B"] as const).map((m) => <option key={m} value={m}>{`Master ${m}${m === def ? " · default" : ""}`}</option>)}
        <option value="none">None</option>
      </select>
      <div className="mt-1.5 flex h-[16.8px] items-center text-xs leading-[16.8px]" style={{ color: SUB }} data-testid="spread-master-status">
        <span>{masterStatus(st.doc, sp)}</span>
        {k !== "none" && <button type="button" className="e7-elink ml-auto font-medium" style={{ color: T }} data-testid="spread-master-edit"
          onClick={() => { st.setMode("masters"); st.setNode({ k: "master", id: k }) }}>Edit master</button>}
      </div>
      <div data-testid="spread-spacing">
        <SliderRow label="Margin" resetValue={0} value={m} onChange={(v) => set(v as number, g, "Spread margin", `sm-${sp.id}`)} minValue={0} maxValue={30} step={1}
          formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} className="mt-3.5" />
        <SliderRow label="Gap" resetValue={0} value={g} onChange={(v) => set(m, v as number, "Spread gap", `sg-${sp.id}`)} minValue={0} maxValue={20} step={1}
          formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} className="mt-2" />
      </div>
      {!sp.template && <div className="mt-1.5 text-xs text-muted-foreground">Margin and gap re-flow template layouts</div>}
    </Section>
  )
}

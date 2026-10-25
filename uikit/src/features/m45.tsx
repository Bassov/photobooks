/* M4.5 Text, styles and reuse */
import * as React from "react"
import { Layers, Pencil, Check, Link2, Eye, EyeOff, RotateCcw, Save, LayoutTemplate, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TextField, Input } from "@/components/ui/textfield"
import { Label } from "@/components/ui/field"
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/uui/Badge"
import { Section, IconButton, AppModal } from "@/components/app/ui"
import { SwitchRow, SelectRow } from "@/components/app/controls"
import { useStudio, mapSpread } from "@/sandbox/store"
import { makeDoc, spread, frame, textFrame, uid, SW, SH, type Doc, type Frame, type Parent } from "@/sandbox/model"
import { TopBar, Dock, PanelHeader, TemplateBar } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, GeometrySection, EmptyInspector, MmField, useSelected, DeleteFrameButton } from "@/sandbox/inspector"
import { GridSection, GuidesSection, TextSection, FrameStyleSection, SpreadBgSection } from "@/sandbox/sections"
import { Std } from "./parts"
import type { FeatureDef } from "./types"

/* ---------------------------------------------------------------- sample docs */
const textDoc = (live = false): Doc => {
  const d = makeDoc()
  const sp = d.spreads[3]
  const img = sp.frames[0]
  d.spreads[3] = { ...sp, frames: [...sp.frames.map((f) => ({ ...f, h: f.h - 22 })), textFrame({ x: img.x, y: img.y + img.h - 18, w: img.w, h: 14, text: live ? "{date} · {camera}" : "Morning swim before breakfast", textStyle: "caption", anchor: live ? img.id : undefined, live }),
    ...(live ? [] : [textFrame({ x: 216, y: 14, w: 168, h: 18, text: "Summer by the sea", textStyle: "title", align: "right" })])] }
  return d
}
const styledDoc = (): Doc => {
  const d = makeDoc()
  d.spreads = d.spreads.map((s, i) => (i >= 2 && i <= 4 ? { ...s, frames: s.frames.map((f) => ({ ...f, styleId: "st-white" })), bg: "#f6f2ea" } : s))
  return d
}
const PARENTS = (): Parent[] => [
  { id: "pa", name: "A · Running header", frames: [textFrame({ id: "pa-h", x: 15, y: 6, w: 120, h: 8, text: "SUMMER BY THE SEA", textStyle: "caption" }), textFrame({ id: "pa-h2", x: 265, y: 6, w: 120, h: 8, text: "2026", textStyle: "caption", align: "right" })],
    guides: [{ id: "pg1", axis: "h", pos: 16, scope: "parent" }, { id: "pg2", axis: "h", pos: 184, scope: "parent" }], grid: { cols: 4, top: 18 }, pageNumbers: true },
  { id: "pb", name: "B · Photo + caption", frames: [frame({ id: "pb-f", x: 220, y: 20, w: 160, h: 130 }), textFrame({ id: "pb-t", x: 220, y: 156, w: 160, h: 12, text: "Caption", textStyle: "caption" })], guides: [{ id: "pg3", axis: "v", pos: 220, scope: "parent" }], grid: { cols: 3 }, pageNumbers: true },
]
const parentDoc = (): Doc => {
  const d = makeDoc(undefined, { parents: PARENTS(), pageStart: 1, skipFirst: true })
  d.spreads = d.spreads.map((s, i) => (i >= 1 && i <= 6 ? { ...s, parent: i === 5 ? "pb" : "pa" } : s))
  d.spreads[5] = { ...d.spreads[5], template: null, frames: [frame({ x: 20, y: 20, w: 180, h: 160, photo: "p04" })] }
  return d
}

/* ---------------------------------------------------------------- parent workbench (edit parent ↔ book) */
function enterParent(st: ReturnType<typeof useStudio>, pid: string) {
  const par = st.doc.parents.find((p) => p.id === pid)!
  st.update((d) => ({ ...d, stash: { spreads: d.spreads, cur: st.cur, parent: pid }, spreads: [{ id: `edit-${pid}`, template: null, frames: par.frames, guides: par.guides, grid: par.grid }] }), `Edit parent “${par.name}”`)
  st.setCur(0); st.setSel([]); st.setStatus(`Editing parent “${par.name}” — changes apply to every spread that uses it`)
}
function exitParent(st: ReturnType<typeof useStudio>) {
  const sh = st.doc.stash; if (!sh) return
  st.update((d) => {
    const e = d.spreads[0]
    return { ...d, parents: d.parents.map((p) => (p.id === sh.parent ? { ...p, frames: e.frames, guides: e.guides, grid: e.grid } : p)), spreads: sh.spreads, stash: undefined }
  }, "Done editing parent")
  st.setCur(sh.cur); st.setSel([]); st.setStatus("")
}
function ParentsPanel() {
  const st = useStudio()
  const sh = st.doc.stash
  const spreads = sh?.spreads ?? st.doc.spreads
  return (
    <aside className="flex min-h-0 flex-col border-r bg-chrome" data-testid="parents-panel">
      <PanelHeader icon={<Layers />} title="Parents" meta={`${st.doc.parents.length}`} />
      <div className="flex flex-col gap-1 p-1">
        {st.doc.parents.map((p) => {
          const n = spreads.filter((s) => s.parent === p.id).length
          const on = sh?.parent === p.id
          return (
            <div key={p.id} className={cn("group/pp flex flex-col gap-1 rounded-lg p-2", on ? "bg-accent" : "hover:bg-accent/50")}>
              <div className="relative overflow-hidden rounded-2xs bg-white shadow-hairline" style={{ width: 160, height: 80 }}>
                {p.frames.map((f) => <div key={f.id} className={cn("absolute", f.kind === "text" ? "border-b " : "border border-dashed  bg-parent-tint")} style={{ left: f.x * 0.4, top: f.y * 0.4, width: f.w * 0.4, height: f.kind === "text" ? 2 : f.h * 0.4 }} />)}
                <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
                {p.pageNumbers && <><Hash className="absolute bottom-1 left-1 size-2.5 text-parent-fg" /><Hash className="absolute bottom-1 right-1 size-2.5 text-parent-fg" /></>}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                {on ? <Button size="xs" className="gap-1 px-2 text-xs [&_svg]:size-3" onPress={() => exitParent(st)} data-testid="parent-done">Done</Button>
                  : <Button size="xs" variant="outline" isDisabled={!!sh} className="gap-1 px-2 text-xs shadow-xs [&_svg]:size-3" onPress={() => enterParent(st, p.id)} data-testid={`edit-${p.id}`}><Pencil />Edit</Button>}
              </div>
              <span className="text-2xs text-muted-foreground">used on {n} spread{n === 1 ? "" : "s"}</span>
            </div>
          )
        })}
      </div>
      {!sh && <div className="mt-auto border-t p-3 text-xs leading-relaxed text-muted-foreground">Assign a parent in Inspector → Spread. Parent items show a quiet dashed outline on spreads.</div>}
    </aside>
  )
}
function ParentBanner() {
  const st = useStudio()
  const sh = st.doc.stash
  if (!sh) return null
  const p = st.doc.parents.find((x) => x.id === sh.parent)!
  return (
    <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border  bg-parent-tint py-1 pl-3 pr-1 text-sm text-parent-tint-fg shadow-sm  " data-testid="parent-banner">
      <Layers className="size-3.5" />Editing parent <b>{p.name}</b> · {sh.spreads.filter((s) => s.parent === p.id).length} spreads follow it
      <Button size="xs" className="gap-1 px-2 text-xs [&_svg]:size-3" onPress={() => exitParent(st)}>Done</Button>
    </div>
  )
}
function ParentAssign() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  if (st.doc.stash) return <Section title="Parent"><div className="text-xs text-muted-foreground">You are editing a parent. Press Done to return to the book.</div></Section>
  return (
    <Section title="Parent" summary={st.doc.parents.find((p) => p.id === s.parent)?.name.split(" · ")[0] ?? "None"}>
      <SelectRow label="Parent spread" value={s.parent ?? "none"} onChange={(v) => { st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, parent: v === "none" ? null : v, hiddenParent: [] })), v === "none" ? "Remove parent" : "Apply parent"); }} items={[["none", "None"], ...st.doc.parents.map((p) => [p.id, p.name] as [string, string])]} />
    </Section>
  )
}
function ParentItems() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const par = st.doc.parents.find((p) => p.id === s.parent)
  if (!par || st.doc.stash) return null
  const hidden = new Set(s.hiddenParent ?? [])
  const ov = new Map(s.frames.filter((f) => f.overrides).map((f) => [f.overrides!, f.id]))
  const items = [...par.frames.map((f) => ({ id: f.id, label: f.kind === "text" ? `Text “${(f.text ?? "").slice(0, 18)}”` : "Image frame", kind: "item" })), ...par.guides.map((g) => ({ id: g.id, label: `Guide ${g.axis === "v" ? "X" : "Y"} ${g.pos} mm`, kind: "guide" }))]
  const toggle = (id: string) => st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, hiddenParent: hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id] })), hidden.has(id) ? "Show parent item" : "Hide parent item")
  const reset = (id: string) => st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, frames: sp.frames.filter((f) => f.overrides !== id) })), "Reset override")
  const override = (id: string) => {
    const src = par.frames.find((f) => f.id === id); if (!src) return
    const copy = { ...src, id: uid(), overrides: id }
    st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, frames: [...sp.frames, copy] })), "Override parent item"); st.setSel([copy.id])
  }
  return (
    <Section title="Parent items" summary={`${ov.size} overridden · ${hidden.size} hidden`}>
      <ul className="flex flex-col gap-1" data-testid="parent-items">
        {items.map((it) => (
          <li key={it.id} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-sm", hidden.has(it.id) && "text-muted-foreground line-through")}>
            <Link2 className="size-3.5 shrink-0 text-parent-fg" /><span className="min-w-0 flex-1 truncate">{it.label}</span>
            {ov.has(it.id) ? <><Badge color="brand">override</Badge><IconButton size="sm" label="Reset to parent" onPress={() => reset(it.id)}><RotateCcw className="size-3.5!" /></IconButton></>
              : it.kind === "item" && !hidden.has(it.id) && <Button size="xs" variant="ghost" className="px-2 text-xs" onPress={() => override(it.id)}>Override</Button>}
            <IconButton size="sm" label={hidden.has(it.id) ? "Show on this spread" : "Hide on this spread"} onPress={() => toggle(it.id)}>{hidden.has(it.id) ? <EyeOff className="size-3.5!" /> : <Eye className="size-3.5!" />}</IconButton>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-xs text-muted-foreground">Alt+click a parent item on the canvas to override it here.</div>
    </Section>
  )
}
function PageNumbersSection() {
  const st = useStudio()
  return (
    <Section title="Page numbers">
      <div className="flex flex-col gap-2" data-testid="page-numbers">
        <SwitchRow isSelected={st.view.pageNumbers} onChange={(v) => st.setView({ pageNumbers: v })}>Show on every page (book-wide)</SwitchRow>
        <MmField label="First page number" unit="" value={st.doc.pageStart ?? 1} min={0} max={99} onChange={(v) => st.update((d) => ({ ...d, pageStart: Math.round(v) }), "Page start", "pstart")} />
        <SwitchRow isSelected={!!st.doc.skipFirst} onChange={(v) => st.update((d) => ({ ...d, skipFirst: v }), "Skip first page")}>Skip number on the first page</SwitchRow>
        <div className="text-xs text-muted-foreground">Parents with a <span className="font-mono">#</span> token show numbers on their spreads: left page even, right odd.</div>
      </div>
    </Section>
  )
}
function PFrameTab() { const { f } = useSelected(); return f ? <>{f.kind === "text" ? <TextSection /> : <PhotoSection />}<GeometrySection rotation={false} /><DeleteFrameButton /></> : <EmptyInspector /> }
function ParentStd({ spread: sp, book, features, view, cur = 3 }: { spread: React.ReactNode; book?: React.ReactNode; features?: object; view?: object; cur?: number }) {
  return <Std init={parentDoc} cur={cur} view={{ guides: true, ...view }} features={{ drop: true, handles: true, ...features }} left={<ParentsPanel />} canvasExtra={<ParentBanner />}
    top={<TopBar tools={["select", "frame", "text", "hand"]} views={["snap", "grid", "guides", "rulers"]} />}
    right={<InspectorPanel frame={<PFrameTab />} spread={<><ParentAssign />{sp}</>} book={book} defaultTab="spread" />} />
}

/* ---------------------------------------------------------------- user templates */
function UserTemplates() {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("My layout")
  const ut = st.doc.userTemplates ?? []
  const s = st.doc.spreads[st.cur]
  const save = () => {
    const frames = s.frames.map((f) => ({ ...f, photo: null, id: uid() }))
    st.update((d) => ({ ...d, userTemplates: [...(d.userTemplates ?? []), { id: uid("ut"), name, frames }] }), "Save as template")
    setOpen(false); st.toast({ tone: "success", title: `Template “${name}” saved`, description: "Available in every book in your library." }, 3000)
  }
  const apply = (t: { name: string; frames: Frame[] }) => {
    const ph = s.frames.filter((f) => f.kind === "image" && f.photo).map((f) => f.photo)
    let k = 0
    st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, template: null, frames: t.frames.map((f) => ({ ...f, id: uid(), photo: f.kind === "image" ? ph[k++] ?? null : null })) })), `Template “${t.name}”`)
    st.setStatus(`Applied “${t.name}” · ${Math.min(k, ph.length)} photos kept${ph.length > k ? ` · ${ph.length - k} back to the gallery` : ""}`)
  }
  return (
    <>
      <div className="flex items-start gap-3" data-testid="user-templates">
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-3.5" onPress={() => setOpen(true)} data-testid="save-template"><Save />Save spread as template</Button>
          <span className="w-[180px] text-2xs leading-snug text-muted-foreground">Frames are normalized to trim; slot aspects are kept.</span>
        </div>
        <div className="flex gap-2 overflow-x-auto p-1 pb-2">
          {ut.length === 0 && <div className="grid h-[62px] w-[220px] place-items-center rounded-md border border-dashed text-xs text-muted-foreground">No templates of your own yet</div>}
          {ut.map((t) => (
            <button key={t.id} type="button" onClick={() => apply(t)} className="flex shrink-0 flex-col gap-1 rounded-xs text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              <span className="relative block rounded-2xs bg-white shadow-hairline" style={{ width: 92, height: 46 }}>
                {t.frames.map((f) => <span key={f.id} className={cn("absolute", f.kind === "text" ? "h-px bg-placeholder-fg" : "bg-placeholder-block")} style={{ left: (f.x / SW) * 92, top: (f.y / SH) * 46, width: (f.w / SW) * 92, height: f.kind === "text" ? 1 : (f.h / SH) * 46 }} />)}
                <span className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
              </span>
              <span className="flex w-[92px] items-center gap-1 truncate text-2xs text-muted-foreground"><LayoutTemplate className="size-3" />{t.name}</span>
            </button>
          ))}
        </div>
        <div className="ml-2 border-l pl-3"><TemplateBar ids={["t-pair", "t-hero2", "t-three"]} /></div>
      </div>
      <AppModal isOpen={open} isDismissable={false} width={420}>
        <DialogHeader><DialogTitle>Save spread as template</DialogTitle><DialogDescription>{s.frames.length} frames · photos are not saved, only the layout.</DialogDescription></DialogHeader>
        <TextField value={name} onChange={setName} autoFocus className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Name</Label><Input className="h-9 text-sm" /></TextField>
        <DialogFooter><Button size="md" variant="outline" onPress={() => setOpen(false)}>Cancel</Button><Button size="md" isDisabled={!name.trim()} onPress={save}>Save template</Button></DialogFooter>
      </AppModal>
    </>
  )
}
const userTplDoc = (): Doc => {
  const d = makeDoc()
  d.spreads[2] = spread(null, [], { frames: [frame({ x: 14, y: 14, w: 120, h: 172, photo: "p16" }), frame({ x: 144, y: 14, w: 50, h: 82, photo: "p07" }), frame({ x: 144, y: 104, w: 50, h: 82, photo: "p11" }), frame({ x: 216, y: 30, w: 168, h: 112, photo: "p03" }), textFrame({ x: 216, y: 150, w: 168, h: 12, text: "A long afternoon", textStyle: "caption" })] })
  return d
}

export const M45: Record<string, FeatureDef> = {
  "text-blocks": {
    Demo: () => <Std init={() => textDoc(false)} cur={3} features={{ drop: true, handles: true, textEdit: true }} pick={2} top={<TopBar tools={["select", "frame", "text", "hand"]} />} right={<InspectorPanel frame={<PFrameTab />} />} />,
    notes: { what: "Text frames edited right on the canvas (double-click); built-in styles Title, Caption, Body; alignment.", where: "Text tool (T) → draw a frame; inspector → Text.", why: "The story next to the photos — no external editor.", keys: [["T", "Text tool"], ["dbl-click", "edit"], ["Ctrl+Enter / Esc", "finish"]], edge: ["Empty text shows a placeholder", "Overset text is reported by preflight", "Fonts come from the curated book font set"] },
  },
  "live-captions": {
    Demo: () => <Std init={() => textDoc(true)} cur={3} features={{ drop: true, handles: true, textEdit: true, swap: true }} pick={2} right={<InspectorPanel frame={<LiveTab />} />} />,
    notes: { what: "A caption anchored to a photo frame; tokens {date}, {title}, {camera}, {filename} are filled from EXIF / metadata; replacing the photo updates the caption.", where: "Inspector → Text → Live from photo metadata.", why: "Dates and places without typing.", edge: ["Drag another photo into the frame — the caption changes", "No EXIF → the token is empty, never “undefined”", "Detach turns it into plain text"] },
  },
  "frame-styles": {
    Demo: () => <Std init={styledDoc} cur={3} pick={0} features={{ drop: true, handles: true }} right={<InspectorPanel frame={<StyleTab />} spread={<SpreadBgSection />} />} />,
    notes: { what: "Create, edit and apply frame styles from the inspector; editing a style changes every frame that uses it; spread background.", where: "Inspector → Frame style; Spread → Background.", why: "A consistent look without styling every frame by hand.", edge: ["A “will update N frames” counter before editing", "The None style cannot be edited", "Undo restores both the style and the frames"] },
  },
  "user-templates": {
    Demo: () => <Std init={userTplDoc} features={{ drop: true, handles: true }} dock={<Dock templates={<UserTemplates />} defaultTab="templates" />} />,
    notes: { what: "Save a spread as a template (frames normalised to the trim, slot orientations kept); your templates sit next to the built-in ones.", where: "Dock → Templates → “Save spread as template”.", why: "Repeatable signature layouts.", edge: ["Photos are not saved into the template", "Empty name — the button is disabled", "A template with fewer frames sends extra photos back to the filmstrip"] },
  },
  "parent-spreads": {
    Demo: () => <ParentStd spread={<ParentItems />} />,
    notes: { what: "Edit parents (shared items) and assign a parent to a spread, or “None”.", where: "Parents panel on the left → Edit; inspector → Spread → Parent.", why: "Running heads and repeated items in one place.", edge: ["Parent edit mode shows a banner and Done", "Parent items on a spread have a quiet dashed outline and cannot be selected", "A “used on N spreads” counter"] },
  },
  "layout-grids-parent-inherit": {
    Demo: () => <ParentStd view={{ grid: true }} spread={<GridSection scope="spread" />} book={<GridSection scope="book" title="Book grid" />} />,
    notes: { what: "Grid section while editing a parent; spread overrides apply on top of the parent; BOOK / PARENT / SPREAD source labels.", where: "Inspector → Spread → Layout grid (the parent grid in parent mode).", why: "Different sections of a book, different rhythm.", edge: ["Reset returns to the parent grid, not the book grid", "Changing the parent re-flows templated spreads"] },
  },
  "parent-guides": {
    Demo: () => <ParentStd view={{ rulers: true, guides: true }} spread={<GuidesSection bookScope={false} />} />,
    notes: { what: "Guides created while editing a parent belong to it; on spreads they are drawn dashed on top of the spread’s own guides.", where: "Rulers and the Spread tab → Guides.", why: "The same lines on every spread of a section.", edge: ["Parent guides cannot be moved on a spread — the status explains why", "Show / hide and snapping apply to both levels"] },
  },
  "parent-overrides": {
    Demo: () => <ParentStd features={{ overrides: true }} spread={<ParentItems />} />,
    notes: { what: "Alt+click or the Override button creates a local copy of a parent item; an item can be hidden on this spread only; Reset restores the link.", where: "Canvas; inspector → Spread → Parent items.", why: "Exceptions without giving up the parent.", keys: [["Alt+click", "override a parent item"]], edge: ["An override badge on the canvas and in the list", "Hidden items are struck through", "Editing the parent leaves overridden copies alone"] },
  },
  "page-numbers": {
    Demo: () => <ParentStd cur={1} spread={<ParentItems />} book={<PageNumbersSection />} />,
    notes: { what: "A page-number token on parents; the number is computed from the spread position (left = even); start number and skipping the first page.", where: "Inspector → Book → Page numbers.", why: "A printed book without manual numbering.", edge: ["The cover is not numbered", "Reordering spreads renumbers pages", "Preview shows numbers as printed"] },
  },
}
function LiveTab() { const { f } = useSelected(); return f ? <>{f.kind === "text" ? <TextSection live /> : <PhotoSection />}<GeometrySection rotation={false} /></> : <EmptyInspector /> }
function StyleTab() { const { f } = useSelected(); return f ? <><FrameStyleSection /><PhotoSection /></> : <EmptyInspector hint="Select a photo frame to apply a style." /> }


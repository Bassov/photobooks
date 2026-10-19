/* Extra inspector sections (M4 / M4.5 / M6): layout grid, guides, spread background, text, frame styles. */
import * as React from "react"
import { Lock, Unlock, Trash2, Plus, RotateCcw, SeparatorVertical, SeparatorHorizontal, Link2, AlignLeft, AlignCenter, AlignRight, Braces } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TextArea } from "@/components/ui/textfield"
import { TextField } from "@/components/ui/textfield"
import { Section, IconButton } from "@/components/app/ui"
import { Segmented, SelectRow, SwitchRow, SliderRow } from "@/components/app/controls"
import { Badge } from "@/components/uui/Badge"
import { P } from "@/data"
import { useStudio, mapSpread } from "./store"
import { effectiveGrid, allGuides, uid, type Grid, type Guide, type FrameStyle } from "./model"
import { MmField, useSelected } from "./inspector"

const SRC: Record<string, string> = { book: "text-muted-foreground/70", parent: "text-[#5f7894]", spread: "text-select" }
const GRID_FIELDS: [keyof Grid, string, string, number][] = [
  ["top", "Top", "mm", 1], ["bottom", "Bottom", "mm", 1], ["inside", "Inside", "mm", 1], ["outside", "Outside", "mm", 1],
  ["cols", "Columns", "", 1], ["rows", "Rows", "", 1], ["colGutter", "Column gutter", "mm", 0.5], ["rowGutter", "Row gutter", "mm", 0.5],
]

/** scope "book" edits doc.grid; "spread" overrides single fields on the current spread; "parent" edits the parent being edited */
export function GridSection({ scope, parentId, title = "Layout grid" }: { scope: "book" | "spread" | "parent"; parentId?: string; title?: string }) {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const par = parentId ? st.doc.parents.find((p) => p.id === parentId) : undefined
  const g = scope === "book" ? { ...st.doc.grid, src: Object.fromEntries(Object.keys(st.doc.grid).map((k) => [k, "book"])) as Record<keyof Grid, string> }
    : scope === "parent" ? (() => { const e = effectiveGrid({ ...st.doc, parents: par ? [par] : [] }, { ...s, parent: par?.id, grid: undefined }); return e })()
      : effectiveGrid(st.doc, s)
  const set = (k: keyof Grid, v: number) => {
    const lim = k === "cols" || k === "rows" ? Math.max(1, Math.min(12, Math.round(v))) : Math.max(0, Math.min(60, v))
    if (scope === "book") st.update((d) => ({ ...d, grid: { ...d.grid, [k]: lim } }), "Book grid", `grid-${k}`)
    else if (scope === "parent") st.update((d) => ({ ...d, parents: d.parents.map((p) => (p.id === parentId ? { ...p, grid: { ...p.grid, [k]: lim } } : p)) }), "Parent grid", `pgrid-${k}`)
    else st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, grid: { ...sp.grid, [k]: lim } })), "Spread grid override", `sgrid-${k}`)
  }
  const overridden = scope === "spread" && !!s.grid && Object.keys(s.grid).length > 0
  return (
    <Section title={title} summary={`${g.cols}×${g.rows}`} right={<IconButton label={st.view.grid ? "Hide grid (Ctrl+')" : "Show grid (Ctrl+')"} size="sm" onPress={() => st.setView({ grid: !st.view.grid })} className={st.view.grid ? "text-select" : ""}><SeparatorVertical className="size-3.5!" /></IconButton>}>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5" data-testid="grid-fields">
        {GRID_FIELDS.map(([k, l, unit, step]) => (
          <MmField key={k} label={l} unit={unit} step={step} value={g[k] as number} onChange={(v) => set(k, v)}
            source={scope !== "book" ? <span className={cn("ml-auto text-[10px] font-medium uppercase tracking-wide", SRC[g.src[k]])}>{g.src[k]}</span> : undefined} />
        ))}
      </div>
      {scope === "spread" && (
        <Button variant="ghost" size="sm" isDisabled={!overridden} className="mt-2.5 h-8 w-full gap-1.5 text-[13px] text-muted-foreground [&_svg]:size-3.5" data-testid="grid-reset"
          onPress={() => st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, grid: undefined })), "Reset to book grid")}><RotateCcw />Reset to {s.parent ? "parent" : "book"} grid</Button>
      )}
      <div className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">Facing pages are mirrored: inside = spine side. {scope === "spread" ? "Fields marked SPREAD override the book on this spread only." : "Applies to every spread without an override."}</div>
    </Section>
  )
}

export function GuidesSection({ bookScope = true, precise = true }: { bookScope?: boolean; precise?: boolean }) {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const gs = allGuides(st.doc, s)
  const [axis, setAxis] = React.useState<"v" | "h">("v")
  const [pos, setPos] = React.useState(100)
  const edit = (id: string, patch: Partial<Guide>, label: string, key?: string) =>
    st.update((d) => ({ ...d, spreads: d.spreads.map((sp, i) => (i === st.cur || sp.guides.some((g) => g.id === id && g.scope === "book") ? { ...sp, guides: sp.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : sp)) }), label, key)
  const del = (id: string) => st.update((d) => ({ ...d, spreads: d.spreads.map((sp) => ({ ...sp, guides: sp.guides.filter((g) => g.id !== id) })) }), "Delete guide")
  const setScope = (g: Guide, scope: "book" | "spread") => st.update((d) => ({
    ...d, spreads: d.spreads.map((sp, i) => {
      const without = sp.guides.filter((x) => x.id !== g.id)
      if (scope === "book") return { ...sp, guides: [...without, { ...g, scope }] }
      return i === st.cur ? { ...sp, guides: [...without, { ...g, scope }] } : { ...sp, guides: without }
    }),
  }), scope === "book" ? "Make book guide" : "Make spread guide")
  const add = () => { const id = uid("g"); st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, guides: [...sp.guides, { id, axis, pos, scope: "spread" }] })), "Add guide"); st.setView({ guides: true }) }
  return (
    <Section title="Guides" summary={`${gs.length}`}>
      {precise && (
        <div className="mb-3 flex items-end gap-1.5" data-testid="guide-add">
          <Segmented label="Axis" size="sm" value={axis} onChange={(v) => setAxis(v as "v")} className="w-[74px]" items={[{ id: "v", label: <SeparatorVertical />, aria: "Vertical" }, { id: "h", label: <SeparatorHorizontal />, aria: "Horizontal" }]} />
          <MmField label="Position" prefix={axis === "v" ? "X" : "Y"} value={pos} onChange={setPos} min={0} max={axis === "v" ? 400 : 200} className="flex-1" />
          <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-[13px] shadow-xs [&_svg]:size-3.5" onPress={add}><Plus />Add</Button>
        </div>
      )}
      {gs.length === 0 ? <div className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">No guides. Drag from a ruler{precise ? " or type a position" : ""}.</div> : (
        <ul className="flex flex-col gap-1" data-testid="guide-list">
          {gs.map((g) => (
            <li key={g.id} className="flex items-center gap-1">
              {g.axis === "v" ? <SeparatorVertical className="size-3.5 shrink-0 text-muted-foreground" /> : <SeparatorHorizontal className="size-3.5 shrink-0 text-muted-foreground" />}
              {precise ? <MmField label="Guide position" prefix={g.axis === "v" ? "X" : "Y"} value={g.pos} isDisabled={g.locked || g.inherited} onChange={(v) => edit(g.id, { pos: v }, "Move guide", `gp-${g.id}`)} className="flex-1" />
                : <span className="flex-1 text-[12.5px] tabular-nums">{g.axis === "v" ? "X" : "Y"} {Math.round(g.pos * 10) / 10} mm</span>}
              {g.inherited ? <Badge color="brand" className="shrink-0"><Link2 />parent</Badge> : <>
                {bookScope && <button type="button" onClick={() => setScope(g, g.scope === "book" ? "spread" : "book")} className={cn("h-6 shrink-0 rounded-md border px-1.5 text-[10.5px] font-medium", g.scope === "book" ? "border-select/50 bg-select/10 text-select" : "text-muted-foreground")} aria-label="Toggle book / spread guide">{g.scope === "book" ? "book" : "spread"}</button>}
                {precise && <IconButton size="sm" label={g.locked ? "Unlock guide" : "Lock guide"} onPress={() => edit(g.id, { locked: !g.locked }, g.locked ? "Unlock guide" : "Lock guide")}>{g.locked ? <Lock className="size-3.5!" /> : <Unlock className="size-3.5!" />}</IconButton>}
                <IconButton size="sm" label="Delete guide" isDisabled={g.locked} onPress={() => del(g.id)}><Trash2 className="size-3.5!" /></IconButton>
              </>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

const BGS = ["#ffffff", "#f6f2ea", "#ece7df", "#dfe3e6", "#2a2927", "#111111"]
export function SpreadBgSection() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  return (
    <Section title="Background">
      <div className="flex gap-1.5" data-testid="bg-swatches">
        {BGS.map((c) => <button key={c} type="button" aria-label={`Background ${c}`} onClick={() => st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, bg: c })), "Spread background")}
          className={cn("size-7 rounded-md border shadow-xs outline-offset-2", (s.bg ?? "#ffffff") === c && "outline-2 outline-select [outline-style:solid]")} style={{ background: c }} />)}
      </div>
    </Section>
  )
}

const TOKENS = ["{date}", "{title}", "{camera}", "{filename}"]
export function TextSection({ live = false }: { live?: boolean }) {
  const { f, set, s } = useSelected()
  if (!f || f.kind !== "text") return null
  const imgs = s.frames.filter((x) => x.kind === "image" && x.photo)
  return (
    <Section title="Text">
      <Segmented label="Style" size="sm" value={f.textStyle ?? "caption"} onChange={(v) => set({ textStyle: v as "title" }, "Text style")} items={[{ id: "title", label: "Title" }, { id: "caption", label: "Caption" }, { id: "body", label: "Body" }]} />
      <div className="mt-2.5 flex items-center gap-1.5">
        <Segmented label="Align" size="sm" value={f.align ?? "left"} onChange={(v) => set({ align: v as "left" }, "Align text")} className="w-[96px]"
          items={[{ id: "left", label: <AlignLeft />, aria: "Left" }, { id: "center", label: <AlignCenter />, aria: "Center" }, { id: "right", label: <AlignRight />, aria: "Right" }]} />
        <span className="ml-auto text-[11px] text-muted-foreground">dbl-click to edit on canvas</span>
      </div>
      <TextField aria-label="Text" value={f.text ?? ""} onChange={(v) => set({ text: v }, "Edit text", `txt-${f.id}`)} className="mt-2.5">
        <TextArea className="min-h-16 text-[13px] shadow-xs" />
      </TextField>
      {live && (
        <div className="mt-3 flex flex-col gap-2.5 border-t pt-3" data-testid="live-caption">
          <SwitchRow isSelected={!!f.live} onChange={(v) => set({ live: v }, v ? "Make caption live" : "Detach caption")}>Live from photo metadata</SwitchRow>
          <SelectRow label="Anchored to" value={f.anchor ?? ""} onChange={(v) => set({ anchor: v }, "Anchor caption")} items={imgs.map((x, i) => [x.id, `Frame ${i + 1} · ${P(x.photo!).name}`] as [string, string])} />
          <div className="flex flex-wrap gap-1">{TOKENS.map((t) => (
            <button key={t} type="button" onClick={() => set((x) => ({ text: `${x.text ?? ""}${x.text ? " · " : ""}${t}`, live: true }), "Insert token")} className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-1.5 font-mono text-[11px] shadow-xs hover:bg-accent"><Braces className="size-3 text-muted-foreground" />{t.slice(1, -1)}</button>
          ))}</div>
        </div>
      )}
    </Section>
  )
}

export function FrameStyleSection() {
  const { f, set, st } = useSelected()
  if (!f || f.kind !== "image") return null
  const cur = st.doc.styles.find((x) => x.id === (f.styleId ?? "st-none")) ?? st.doc.styles[0]
  const uses = st.doc.spreads.reduce((a, s) => a + s.frames.filter((x) => (x.styleId ?? "st-none") === cur.id).length, 0)
  const editStyle = (patch: Partial<FrameStyle>, key: string) => st.update((d) => ({ ...d, styles: d.styles.map((x) => (x.id === cur.id ? { ...x, ...patch } : x)) }), `Edit style “${cur.name}”`, `${key}-${cur.id}`)
  const newStyle = () => {
    const id = uid("st"); const n = { ...cur, id, name: `Style ${st.doc.styles.length}` }
    st.update((d) => ({ ...d, styles: [...d.styles, n] }), "New frame style"); set({ styleId: id }, "Apply style")
  }
  return (
    <Section title="Frame style" summary={cur.name}>
      <div className="grid grid-cols-4 gap-1.5" data-testid="style-list">
        {st.doc.styles.map((x) => (
          <button key={x.id} type="button" onClick={() => set({ styleId: x.id }, `Apply “${x.name}”`)} aria-label={x.name}
            className={cn("flex flex-col items-center gap-1 rounded-md border bg-background p-1.5 text-[10px] shadow-xs", x.id === cur.id && "border-select ring-1 ring-select")}>
            <span className="block h-7 w-9 bg-cover" style={{ backgroundImage: "url(photos/p09.jpg)", borderRadius: x.radius, boxShadow: `${x.mat ? `0 0 0 ${x.mat}px #fff,` : ""} ${x.stroke ? `0 0 0 ${x.mat + Math.max(1, x.stroke * 2)}px ${x.strokeColor},` : ""} 0 1px 3px rgb(0 0 0/.2)` }} />
            <span className="w-full truncate text-center">{x.name}</span>
          </button>
        ))}
      </div>
      {cur.id !== "st-none" && (
        <div className="mt-3 flex flex-col gap-2.5 border-t pt-3">
          <SliderRow label="Mat" value={cur.mat} onChange={(v) => editStyle({ mat: v as number }, "mat")} minValue={0} maxValue={10} step={0.5} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <SliderRow label="Stroke" value={cur.stroke} onChange={(v) => editStyle({ stroke: v as number }, "stroke")} minValue={0} maxValue={2} step={0.1} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <SliderRow label="Corner radius" value={cur.radius} onChange={(v) => editStyle({ radius: v as number }, "radius")} minValue={0} maxValue={12} step={0.5} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <div className="text-[11.5px] text-muted-foreground">Editing “{cur.name}” updates all <b className="text-foreground">{uses}</b> frames that use it.</div>
        </div>
      )}
      <Button size="sm" variant="outline" className="mt-2.5 h-8 w-full gap-1.5 text-[13px] shadow-xs [&_svg]:size-3.5" onPress={newStyle}><Plus />New style from this frame</Button>
    </Section>
  )
}

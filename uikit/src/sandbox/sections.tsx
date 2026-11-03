/* Extra inspector sections (M4 / M4.5 / M6): guides, spread background, text, frame styles. */
import * as React from "react"
import { Lock, Unlock, Trash2, Plus, SeparatorHorizontal, Link2, AlignLeft, AlignCenter, AlignRight, Braces } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TextArea } from "@/components/ui/textfield"
import { TextField } from "@/components/ui/textfield"
import { Section } from "@/components/app/ui"
import { Segmented, SelectRow, SwitchRow, SliderRow } from "@/components/app/controls"
import { Badge } from "@/components/uui/Badge"
import { P } from "@/data"
import { useStudio, mapSpread } from "./store"
import { allGuides, uid, DEFAULT_STYLES, type Guide, type FrameStyle } from "./model"
import { useSelected } from "./inspector"

const BGS = ["#ffffff", "#f4f4f4", "#e9e9e9", "#e3e3e3", "#2a2927", "#111111"]
export function SpreadBgSection() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  return (
    <Section title="Background">
      <div className="flex gap-1.5" data-testid="bg-swatches">
        {BGS.map((c) => <button key={c} type="button" data-swatch aria-label={`Background ${c}`} onClick={() => st.update((d) => mapSpread(d, st.cur, (sp) => ({ ...sp, bg: c })), "Spread background")}
          className={cn("size-7 rounded-md shadow-hairline outline-offset-2", (s.bg ?? "#ffffff") === c && "swatch-on")} style={{ background: c }} />)}
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
      <div className="mt-2 flex items-center gap-1.5">
        <Segmented label="Align" size="sm" value={f.align ?? "left"} onChange={(v) => set({ align: v as "left" }, "Align text")} className="w-[96px]"
          items={[{ id: "left", label: <AlignLeft />, aria: "Left" }, { id: "center", label: <AlignCenter />, aria: "Center" }, { id: "right", label: <AlignRight />, aria: "Right" }]} />
        <span className="ml-auto text-2xs text-muted-foreground">dbl-click to edit on canvas</span>
      </div>
      <TextField aria-label="Text" value={f.text ?? ""} onChange={(v) => set({ text: v }, "Edit text", `txt-${f.id}`)} className="mt-2">
        {/* Designer text-frames: grows with the content up to 160 px, then scrolls; focus = inset 1 px #535152 (parent-spreads-inspector) */}
        <TextArea className="field-sizing-content max-h-40 min-h-16 overflow-y-auto text-sm shadow-xs data-[focused]:ring-1 data-[focused]:ring-tag data-[focused]:ring-offset-0 data-[focused]:ring-inset" />
      </TextField>
      {live && (
        <div className="mt-3 flex flex-col gap-2 pt-3" data-testid="live-caption">
          <SwitchRow isSelected={!!f.live} onChange={(v) => set({ live: v }, v ? "Make caption live" : "Detach caption")}>Live from photo metadata</SwitchRow>
          <SelectRow label="Anchored to" value={f.anchor ?? ""} onChange={(v) => set({ anchor: v }, "Anchor caption")} items={imgs.map((x, i) => [x.id, `Frame ${i + 1} · ${P(x.photo!).name}`] as [string, string])} />
          <div className="flex flex-wrap gap-1">{TOKENS.map((t) => (
            <button key={t} type="button" onClick={() => set((x) => ({ text: `${x.text ?? ""}${x.text ? " · " : ""}${t}`, live: true }), "Insert token")} className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-1.5 font-mono text-2xs shadow-xs hover:bg-accent"><Braces className="size-3 text-muted-foreground" />{t.slice(1, -1)}</button>
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
            className={cn("flex flex-col items-center gap-1 rounded-md bg-field p-2 text-2xs", x.id === cur.id && "bg-sel font-semibold")}>
            <span className="block h-7 w-9 bg-cover" style={{ backgroundImage: "url(photos/p09.jpg)", borderRadius: x.radius, boxShadow: `${x.mat ? `0 0 0 ${x.mat}px #fff,` : ""} ${x.stroke ? `0 0 0 ${x.mat + Math.max(1, x.stroke * 2)}px ${x.strokeColor},` : ""} 0 1px 3px rgb(0 0 0/.2)` }} />
            <span className="w-full truncate text-center">{x.name}</span>
          </button>
        ))}
      </div>
      {cur.id !== "st-none" && (
        <div className="mt-3 flex flex-col gap-2 pt-3">
          <SliderRow label="Mat" resetValue={DEFAULT_STYLES.find((x) => x.id === cur.id)?.mat ?? 0} value={cur.mat} onChange={(v) => editStyle({ mat: v as number }, "mat")} minValue={0} maxValue={10} step={0.5} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <SliderRow label="Stroke" resetValue={DEFAULT_STYLES.find((x) => x.id === cur.id)?.stroke ?? 0} value={cur.stroke} onChange={(v) => editStyle({ stroke: v as number }, "stroke")} minValue={0} maxValue={2} step={0.1} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <SliderRow label="Corner radius" resetValue={DEFAULT_STYLES.find((x) => x.id === cur.id)?.radius ?? 0} value={cur.radius} onChange={(v) => editStyle({ radius: v as number }, "radius")} minValue={0} maxValue={12} step={0.5} formatOptions={{ style: "unit", unit: "millimeter", unitDisplay: "short" }} />
          <div className="text-xs text-muted-foreground">Editing “{cur.name}” updates all <b className="text-foreground">{uses}</b> frames that use it.</div>
        </div>
      )}
      <Button size="sm" variant="outline" className="mt-2 w-full gap-1.5 text-sm shadow-xs [&_svg]:size-3.5" onPress={newStyle}><Plus />New style from this frame</Button>
    </Section>
  )
}

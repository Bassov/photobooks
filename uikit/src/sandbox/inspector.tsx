/* Sandbox inspector: controlled numeric fields and sections bound to the selected frame(s). */
import * as React from "react"
import { setInspectorOpen } from "./inspectorState"
import {
  Lock, Unlock, RotateCcw, RotateCw, BringToFront, SendToBack, ArrowUp, ArrowDown, Crop,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Trash2, PanelRightClose, MousePointerClick, FlipHorizontal2, FlipVertical2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NumberField, NumberFieldInput } from "@/components/ui/numberfield"
import { FieldGroup, Label } from "@/components/ui/field"
import { Toolbar } from "@/components/ui/toolbar"
import { Badge } from "@/components/uui/Badge"
import { Section, IconButton } from "@/components/app/ui"
import { SliderRow, Segmented } from "@/components/app/controls"
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs"
import { P } from "@/data"
import { useStudio, mapSpread, mapFrames } from "./store"
import { round, clamp, effectiveDpi, type Frame } from "./model"
import { bbox } from "./canvas"
import { segList, segTab } from "./chrome"

export function MmField({ label, prefix, value, onChange, unit = "mm", step = 1, min, max, className, isDisabled, source }: {
  label: string; prefix?: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; min?: number; max?: number; className?: string; isDisabled?: boolean
  source?: React.ReactNode
}) {
  return (
    <NumberField value={round(value, 1)} onChange={(v) => !Number.isNaN(v) && onChange(v)} step={step} minValue={min} maxValue={max} isDisabled={isDisabled}
      aria-label={prefix ? label : undefined} formatOptions={{ maximumFractionDigits: 1 }} className={cn("group flex min-w-0 flex-col gap-1.5", className)}>
      {!prefix && <Label className="flex items-center text-xs font-normal text-muted-foreground">{label}{source}</Label>}
      <FieldGroup className="h-(--control-sm) gap-1.5 rounded-md px-3 py-0 text-sm shadow-xs  data-[focus-within]:ring-[3px] data-[focus-within]:ring-ring/30 data-[focus-within]:ring-offset-0 data-[disabled]:opacity-60">
        {prefix && <span className="min-w-3 shrink-0 text-xs text-muted-foreground">{prefix}</span>}
        <NumberFieldInput className="bg-transparent pr-0 tabular-nums" />
        {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
      </FieldGroup>
    </NumberField>
  )
}

export function useSelected() {
  const st = useStudio()
  const s = st.doc.spreads[st.cur]
  const frames = s ? s.frames.filter((f) => st.sel.includes(f.id)) : []
  const set = (patch: Partial<Frame> | ((f: Frame) => Partial<Frame>), label: string, key?: string) =>
    st.update((d) => mapFrames(d, st.cur, frames.map((f) => f.id), (f) => ({ ...f, ...(typeof patch === "function" ? patch(f) : patch) })), label, key)
  return { st, s, frames, f: frames[0] as Frame | undefined, set }
}

const DEFAULT_HINT = "Select a frame on the spread to see its properties."
export function EmptyInspector({ hint = DEFAULT_HINT }: { hint?: string }) {
  // v4.1: with nothing selected the panel shows the current spread's properties (template, background, grid) above the hint.
  const st = useStudio()
  const s = st?.doc.spreads[st.cur]
  const rows: [string, React.ReactNode][] = s ? [
    ["Spread", st.cur === 0 ? "Cover" : `Pages ${st.cur * 2}–${st.cur * 2 + 1}`],
    ["Template", s.template ? s.template.replace(/^t-/, "").replace(/-/g, " ") : "Free layout"],
    ["Background", <span key="bg" className="inline-flex items-center gap-1.5"><span className="size-3 rounded-2xs shadow-hairline" style={{ background: s.bg ?? "#ffffff" }} />{s.bg && s.bg !== "#ffffff" ? s.bg : "Paper white"}</span>],
    ["Frames", String(s.frames.length)],
    ["Grid", st.view.grid ? "On" : "Off"],
  ] : []
  return (
    <div data-testid="inspector-empty">
      {s && (
        <div className="px-4 pb-4 pt-4">
          <div className="eyebrow mb-3">Spread properties</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([k, v]) => <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right tabular-nums">{v}</dd></React.Fragment>)}
          </dl>
        </div>
      )}
      {s ? <p className="px-4 pt-3 text-xs text-muted-foreground">{hint === DEFAULT_HINT ? "Select a frame to edit it." : hint}</p> : (
        <div className="flex flex-col items-center gap-2 px-6 py-6 text-center text-sm text-muted-foreground"><MousePointerClick className="size-5" />{hint}</div>
      )}
    </div>
  )
}

export function GeometrySection({ rotation = true }: { rotation?: boolean }) {
  const { f, set, frames } = useSelected()
  if (!f) return null
  const lk = !!f.locked
  return (
    <Section title="Position & size" right={<IconButton label={lk ? "Unlock (Ctrl+Shift+L)" : "Lock (Ctrl+Shift+L)"} size="sm" onPress={() => set({ locked: !lk }, lk ? "Unlock" : "Lock")}>{lk ? <Lock className="size-3.5!" /> : <Unlock className="size-3.5!" />}</IconButton>}>
      <div className="grid grid-cols-2 gap-2" data-testid="geometry">
        <MmField label="X" prefix="X" value={f.x} isDisabled={lk} onChange={(v) => set({ x: v, }, "Move", `x-${f.id}`)} />
        <MmField label="Y" prefix="Y" value={f.y} isDisabled={lk} onChange={(v) => set({ y: v }, "Move", `y-${f.id}`)} />
        <MmField label="Width" prefix="W" value={f.w} min={5} isDisabled={lk} onChange={(v) => set({ w: v }, "Resize", `w-${f.id}`)} />
        <MmField label="Height" prefix="H" value={f.h} min={5} isDisabled={lk} onChange={(v) => set({ h: v }, "Resize", `h-${f.id}`)} />
      </div>
      {rotation && (
        <div className="mt-3 grid grid-cols-[1fr_96px] items-end gap-2">
          <SliderRow label="Frame rotation" resetValue={0} value={f.rot} onChange={(v) => set({ rot: v as number }, "Rotate frame", `rot-${f.id}`)} minValue={-180} maxValue={180} isDisabled={lk}
            formatOptions={{ style: "unit", unit: "degree", unitDisplay: "narrow" }} />
          <MmField label="Rotation" prefix="∠" unit="°" value={f.rot} min={-180} max={180} isDisabled={lk} onChange={(v) => set({ rot: v }, "Rotate frame", `rot-${f.id}`)} />
        </div>
      )}
      {frames.length > 1 && <div className="mt-2 text-xs text-muted-foreground">Editing the first of {frames.length} selected frames</div>}
    </Section>
  )
}

export function PhotoSection() {
  const { f, set, st } = useSelected()
  if (!f || f.kind !== "image") return null
  const p = f.photo ? P(f.photo) : null
  const dpi = effectiveDpi(f)
  return (
    <Section title="Photo">
      {p ? (
        <div className="flex gap-3">
          <img src={p.src} className="h-12 w-[72px] shrink-0 rounded-md object-cover shadow-hairline" alt="" />
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium">{p.name}</div>
            <div className="text-xs tabular-nums text-muted-foreground">{p.w} × {p.h} px</div>
            {dpi !== null && (dpi >= 300 ? <Badge color="success" className="mt-1" dot>{dpi} dpi</Badge>
              : <Badge color={dpi < 150 ? "error" : "warning"} className="mt-1" dot>{dpi} dpi · {dpi < 150 ? "too low" : "low"}</Badge>)}
          </div>
        </div>
      ) : <div className="rounded-md bg-field/60 px-3 py-3 text-center text-xs text-muted-foreground" data-testid="empty-slot">Empty — drag a photo</div>}
      {p && <Button variant="ghost" size="md" onPress={() => { set({ photo: null }, "Remove photo"); st.setStatus(`${p.name} is back in the gallery`) }} className="mt-2 h-8 w-full text-sm text-muted-foreground">Remove from frame</Button>}
    </Section>
  )
}

export function CropSection() {
  const { f, set, st } = useSelected()
  if (!f || f.kind !== "image" || !f.photo) return null
  const crop = st.cropId === f.id
  return (
    <Section title="Fit & crop">
      <Segmented label="Photo fit" size="sm" className="mb-3" value={f.fit ?? "fill"} onChange={(v) => set({ fit: v as "fill" | "fit", zoom: 1, ox: 0, oy: 0 }, v === "fit" ? "Fit photo" : "Fill frame")} items={[{ id: "fill", label: "Fill" }, { id: "fit", label: "Fit" }]} />
      <SliderRow label="Zoom" resetValue={1} value={f.zoom} onChange={(v) => set({ zoom: v as number }, "Zoom photo", `zoom-${f.id}`)} minValue={1} maxValue={4} step={0.01} formatOptions={{ style: "percent" }} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MmField label="Pan X" prefix="↔" unit="%" value={Math.round(f.ox * 100)} min={-100} max={100} step={5} onChange={(v) => set({ ox: clamp(v / 100, -1, 1) }, "Pan photo", `ox-${f.id}`)} />
        <MmField label="Pan Y" prefix="↕" unit="%" value={Math.round(f.oy * 100)} min={-100} max={100} step={5} onChange={(v) => set({ oy: clamp(v / 100, -1, 1) }, "Pan photo", `oy-${f.id}`)} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant={crop ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-sm shadow-xs [&_svg]:size-4" onPress={() => st.setCropId(crop ? null : f.id)} data-testid="crop-toggle">{crop ? "Done" : "Crop"}</Button>
        <Button variant="ghost" size="sm" className="flex-1 text-sm text-muted-foreground" isDisabled={f.zoom === 1 && f.ox === 0 && f.oy === 0} onPress={() => set({ zoom: 1, ox: 0, oy: 0 }, "Reset crop")}>Reset to cover</Button>
      </div>
    </Section>
  )
}

export function PhotoRotateSection() {
  const { f, set } = useSelected()
  if (!f || f.kind !== "image" || !f.photo) return null
  const turn = (d: number) => set((x) => ({ qt: ((((x.qt + d) % 360) + 360) % 360) as Frame["qt"], zoom: 1, ox: 0, oy: 0 }), d > 0 ? "Rotate photo right" : "Rotate photo left")
  return (
    <Section title="Rotate & flip">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-sm shadow-xs [&_svg]:size-4" onPress={() => turn(-90)} data-testid="rot-left"><RotateCcw />90° left</Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-sm shadow-xs [&_svg]:size-4" onPress={() => turn(90)} data-testid="rot-right"><RotateCw />90° right</Button>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" aria-pressed={!!f.flipH} className="flex-1 gap-1.5 text-sm aria-pressed:bg-sel [&_svg]:size-4" onPress={() => set((x) => ({ flipH: !x.flipH }), "Flip horizontal")} data-testid="flip-h"><FlipHorizontal2 />Flip H</Button>
        <Button variant="outline" size="sm" aria-pressed={!!f.flipV} className="flex-1 gap-1.5 text-sm aria-pressed:bg-sel [&_svg]:size-4" onPress={() => set((x) => ({ flipV: !x.flipV }), "Flip vertical")} data-testid="flip-v"><FlipVertical2 />Flip V</Button>
      </div>
      <SliderRow label="Straighten" resetValue={0} value={f.straighten} onChange={(v) => set({ straighten: v as number }, "Straighten", `str-${f.id}`)} minValue={-45} maxValue={45} step={0.5}
        formatOptions={{ style: "unit", unit: "degree", unitDisplay: "narrow" }} className="mt-3" />
      <div className="mt-2 text-xs text-muted-foreground">Quarter turn: {f.qt}° · cover fit recomputed</div>
    </Section>
  )
}

export function ArrangeSection() {
  const { f, frames, st } = useSelected()
  if (!f) return null
  const move = (kind: "front" | "back" | "fwd" | "bwd") => st.update((d) => mapSpread(d, st.cur, (s) => {
    const a = [...s.frames]; const ids = frames.map((x) => x.id)
    const sel = a.filter((x) => ids.includes(x.id)), rest = a.filter((x) => !ids.includes(x.id))
    if (kind === "front") return { ...s, frames: [...rest, ...sel] }
    if (kind === "back") return { ...s, frames: [...sel, ...rest] }
    const i = a.findIndex((x) => x.id === f.id); const j = kind === "fwd" ? Math.min(a.length - 1, i + 1) : Math.max(0, i - 1)
    const [x] = a.splice(i, 1); a.splice(j, 0, x); return { ...s, frames: a }
  }), { front: "Bring to front", back: "Send to back", fwd: "Bring forward", bwd: "Send backward" }[kind])
  const z = st.doc.spreads[st.cur].frames.findIndex((x) => x.id === f.id)
  const b = "size-8 [&_svg]:size-4"
  return (
    <Section title="Arrange" summary={`z ${z + 1}`}>
      <Toolbar aria-label="Arrange" className="flex gap-1">
        {([["back", SendToBack, "Send to back (Shift+Ctrl+[)"], ["bwd", ArrowDown, "Send backward (Ctrl+[)"], ["fwd", ArrowUp, "Bring forward (Ctrl+])"], ["front", BringToFront, "Bring to front (Shift+Ctrl+])"]] as const).map(([k, I, l]) => (
          <IconButton key={k} label={l} className={cn(b, "bg-field")} onPress={() => move(k)} data-testid={`z-${k}`}><I /></IconButton>
        ))}
        <span className="ml-auto self-center text-xs tabular-nums text-muted-foreground">layer {z + 1} of {st.doc.spreads[st.cur].frames.length}</span>
      </Toolbar>
    </Section>
  )
}

export function AlignSection() {
  const { frames, st } = useSelected()
  if (frames.length < 2) return <Section title="Align & distribute" summary="select 2+ frames" defaultExpanded={false}><div className="text-xs text-muted-foreground">Shift+click or drag a marquee to select several frames.</div></Section>
  const bb = bbox(frames)
  const al = (k: string) => st.update((d) => mapFrames(d, st.cur, frames.filter((f) => !f.locked).map((f) => f.id), (f) => {
    switch (k) {
      case "l": return { ...f, x: bb.x }; case "cx": return { ...f, x: round(bb.x + bb.w / 2 - f.w / 2, 2) }; case "r": return { ...f, x: round(bb.x + bb.w - f.w, 2) }
      case "t": return { ...f, y: bb.y }; case "cy": return { ...f, y: round(bb.y + bb.h / 2 - f.h / 2, 2) }; case "b": return { ...f, y: round(bb.y + bb.h - f.h, 2) }
    }
    return f
  }), "Align")
  const dist = (axis: "x" | "y") => st.update((d) => {
    const fs = [...frames].sort((a, b) => a[axis] - b[axis])
    const size = axis === "x" ? "w" : "h"
    const total = fs.reduce((a, f) => a + f[size], 0)
    const span = (axis === "x" ? bb.w : bb.h) - total, gap = span / (fs.length - 1)
    let p = axis === "x" ? bb.x : bb.y
    const pos: Record<string, number> = {}
    for (const f of fs) { pos[f.id] = round(p, 2); p += f[size] + gap }
    return mapFrames(d, st.cur, fs.map((f) => f.id), (f) => ({ ...f, [axis]: pos[f.id] }))
  }, "Distribute")
  return (
    <Section title="Align & distribute" summary={`${frames.length} frames`}>
      <Toolbar aria-label="Align" className="grid grid-cols-8 gap-1">
        {([["l", AlignStartVertical], ["cx", AlignCenterVertical], ["r", AlignEndVertical], ["t", AlignStartHorizontal], ["cy", AlignCenterHorizontal], ["b", AlignEndHorizontal]] as const).map(([k, I]) => (
          <Button key={k} variant="outline" size="icon-xs" aria-label={`Align ${k}`} className="shadow-xs [&_svg]:size-3.5" onPress={() => al(k)} data-testid={`align-${k}`}><I /></Button>
        ))}
        <Button variant="outline" size="icon-xs" aria-label="Distribute horizontally" className="shadow-xs [&_svg]:size-3.5" isDisabled={frames.length < 3} onPress={() => dist("x")}><AlignHorizontalDistributeCenter /></Button>
        <Button variant="outline" size="icon-xs" aria-label="Distribute vertically" className="shadow-xs [&_svg]:size-3.5" isDisabled={frames.length < 3} onPress={() => dist("y")}><AlignVerticalDistributeCenter /></Button>
      </Toolbar>
      <div className="mt-2 text-xs tabular-nums text-muted-foreground">Selection {round(bb.w)} × {round(bb.h)} mm · locked frames are skipped</div>
    </Section>
  )
}

export function DeleteFrameButton() {
  const { frames, st } = useSelected()
  if (!frames.length) return null
  return (
    <div className="p-3">
      <Button variant="destructive-ghost" size="sm" className="w-full gap-1.5 text-sm [&_svg]:size-4"
    onPress={() => { const ids = frames.map((f) => f.id); st.update((d) => mapSpread(d, st.cur, (s) => ({ ...s, template: null, frames: s.frames.filter((f) => !ids.includes(f.id)) })), ids.length > 1 ? `Delete ${ids.length} frames` : "Delete frame"); st.setSel([]) }}>
        <Trash2 />Delete {frames.length > 1 ? `${frames.length} frames` : "frame"}<span className="ml-auto text-xs">Del</span>
      </Button>
    </div>
  )
}

/** Right panel shell: Frame / Spread / Book tabs (inspector feature) */
export function InspectorPanel({ frame, spread, book, defaultTab = "frame", onCollapse }: { frame?: React.ReactNode; spread?: React.ReactNode; book?: React.ReactNode; defaultTab?: string; onCollapse?: () => void }) {
  // v4.2: with nothing selected the frame tab shows the spread's properties, so it is labelled "Spread" (unless a separate Spread tab exists).
  const st = useStudio()
  const none = !!st && st.sel.length === 0
  const tabs = [["frame", none && !spread ? "Spread" : "Frame", frame], ["spread", "Spread", spread], ["book", "Book", book]].filter((t) => t[2]) as [string, string, React.ReactNode][]
  return (
    <aside className="flex min-h-0 flex-col bg-chrome" data-testid="inspector-legacy">
      {tabs.length === 1 ? (
        <>
          {/* proto: a single section gets a plain panel header, not a lone tab that reads as a button */}
          <div className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2" data-testid="inspector-header">
            <h2 className="flex-1 truncate text-sm font-semibold">{tabs[0][1]}</h2>
            <IconButton label="Hide inspector (I)" size="sm" onPress={onCollapse ?? (() => setInspectorOpen(false))}><PanelRightClose /></IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tabs[0][2]}</div>
        </>
      ) : (
      <Tabs defaultSelectedKey={defaultTab} className="min-h-0 flex-1 gap-0">
        <div className="flex h-12 shrink-0 items-center gap-1.5 pl-2 pr-1.5">
          <TabList aria-label="Inspector" className={cn(segList, "grid flex-1")} style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))` }}>
            {tabs.map(([id, l]) => <Tab key={id} id={id} className={segTab}>{l}</Tab>)}
          </TabList>
          <IconButton label="Hide inspector (I)" size="sm" onPress={onCollapse ?? (() => setInspectorOpen(false))}><PanelRightClose /></IconButton>
        </div>
        {tabs.map(([id, , c]) => <TabPanel key={id} id={id} className="mt-0 min-h-0 overflow-y-auto">{c}</TabPanel>)}
      </Tabs>
      )}
    </aside>
  )
}

/* v0.7.2 (P1-5): spec photo params — Adjust and Caption */
export function AdjustSection() {
  const { f, set } = useSelected()
  if (!f || f.kind !== "image" || !f.photo) return null
  const a = f.adj ?? { b: 0, c: 0, s: 0 }
  const row = (k: "b" | "c" | "s", label: string) => <SliderRow key={k} label={label} resetValue={0} value={a[k]} onChange={(v) => set((x) => ({ adj: { ...(x.adj ?? { b: 0, c: 0, s: 0 }), [k]: v as number } }), label, `adj-${k}-${f.id}`)} minValue={-100} maxValue={100} step={1} className="mt-2 first:mt-0" />
  return (
    <Section title="Adjust" summary={f.adj && (a.b || a.c || a.s) ? "Edited" : undefined}>
      <div data-testid="adjust">{row("b", "Brightness")}{row("c", "Contrast")}{row("s", "Saturation")}</div>
      <Button variant="ghost" size="sm" className="mt-2 w-full text-sm text-muted-foreground" isDisabled={!a.b && !a.c && !a.s} onPress={() => set({ adj: undefined }, "Reset adjustments")}>Reset adjustments</Button>
    </Section>
  )
}
export function CaptionSection() {
  const { f, set } = useSelected()
  if (!f || f.kind !== "image") return null
  return (
    <Section title="Caption">
      <input aria-label="Caption" data-testid="caption-input" placeholder="Add a caption under the photo" value={f.caption ?? ""}
        onChange={(e) => set({ caption: e.target.value || undefined }, "Edit caption", `cap-${f.id}`)}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-8 w-full rounded-md bg-field px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="mt-1.5 text-xs text-muted-foreground">Printed 1.5 mm under the frame, Caption style</div>
    </Section>
  )
}

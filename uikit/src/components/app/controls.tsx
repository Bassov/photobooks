/**
 * Dense inspector controls composed from ported JollyUI parts (src/components/ui, MIT).
 * Only layout/density decisions live here; behaviour is the JollyUI/RAC component's.
 */
import * as React from "react"
import { Slider, SliderTrack, SliderFillTrack, SliderThumb, SliderOutput, SliderValueField } from "@/components/ui/slider"
import { SliderStateContext } from "react-aria-components"
import { Label } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { Select, SelectTrigger, SelectValue, SelectPopover, SelectListBox, SelectItem } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/* Range-aware fill between two thumbs (JollyUI SliderFillTrack only fills from 0 to thumb 0) */
function RangeFill() {
  const state = React.useContext(SliderStateContext)!
  const a = state.getThumbPercent(0) * 100, b = state.getThumbPercent(1) * 100
  return <div className="sl-fill absolute h-full rounded-full" style={{ left: `${a}%`, width: `${b - a}%` }} />
}

export function SliderRow({ label, className, ...props }: React.ComponentProps<typeof Slider> & { label: string }) {
  const range = Array.isArray(props.defaultValue)
  return (
    <Slider {...props} className={cn("flex-col items-stretch gap-2", className as string)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs leading-(--text-xs--line-height) font-normal text-muted-foreground">{label}</Label>
        {range ? <SliderOutput className="text-xs leading-(--text-xs--line-height) font-medium tabular-nums text-foreground" /> : <SliderValueField label={label} className="text-xs font-medium tabular-nums text-foreground" />}
      </div>
      <SliderTrack>
        {range ? <RangeFill /> : <SliderFillTrack />}
        <SliderThumb index={0} />
        {range && <SliderThumb index={1} />}
      </SliderTrack>
    </Slider>
  )
}

export function SwitchRow({ children, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch size="sm" {...props} className="w-full flex-row-reverse justify-between gap-3 text-sm leading-(--text-sm--line-height) font-normal">
      {children as React.ReactNode}
    </Switch>
  )
}

/* Radio-group keys like prod src/ui/SegmentedControl (native radios): an arrow moves focus
   AND selects, wrapping at the ends; Right/Down = next, Left/Up = previous. Home/End do
   nothing (native radios ignore them), so RAC's toolbar must not move focus on them either.
   RAC's toolbar handles keys in the capture phase on the group, so this runs one level up
   (a display:contents wrapper, no layout box) and stops the event before the group sees it. */
const SEGMENT_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/* v1-style segmented control: muted track, white raised selected segment */
export function Segmented({ items, defaultValue, value, onChange, label, className, size = "md" }: {
  items: { id: string; label: React.ReactNode; aria?: string }[]; defaultValue?: string; value?: string; onChange?: (v: string) => void; label: string; className?: string; size?: "sm" | "md"
}) {
  const [own, setOwn] = React.useState(defaultValue)
  const current = value ?? own
  const pick = (v: string) => { setOwn(v); onChange?.(v) }
  const onKeyCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = SEGMENT_STEP[e.key]
    if (step === undefined && e.key !== "Home" && e.key !== "End") return
    const radios = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]")]
    const i = radios.indexOf(e.target as HTMLElement)
    if (i < 0) return
    e.stopPropagation()
    if (step === undefined) return
    e.preventDefault()
    const n = (i + step + items.length) % items.length
    radios[n]!.focus()
    if (items[n]!.id !== current) pick(items[n]!.id)
  }
  return (
    <div className="contents" onKeyDownCapture={onKeyCapture}>
    <ToggleButtonGroup selectionMode="single" disallowEmptySelection
      selectedKeys={current !== undefined ? [current] : []} onSelectionChange={(k) => { const v = [...k][0]; if (v !== undefined) pick(String(v)) }} aria-label={label}
      className={cn("grid gap-0.5 rounded-lg bg-field p-0.5", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it) => (
        <Toggle key={it.id} id={it.id} aria-label={it.aria} size="sm"
          className={cn(size === "sm" ? "h-6 text-xs" : "h-7 text-sm", "gap-1.5 rounded-sm px-2 leading-none text-muted-foreground [&_svg]:size-3.5",
            "data-[hovered]:bg-transparent data-[hovered]:text-foreground",
            /* v3: same selected pill as Tabs (ui/tabs.tsx) */
            "data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-pill")}>
          {it.label}
        </Toggle>
      ))}
    </ToggleButtonGroup>
    </div>
  )
}

export function SelectRow({ label, items, defaultValue, value, onChange, className }: { label: string; items: [string, string][]; defaultValue?: string; value?: string; onChange?: (v: string) => void; className?: string }) {
  return (
    <Select defaultSelectedKey={defaultValue} selectedKey={value} onSelectionChange={(k) => k !== null && onChange?.(String(k))} className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs leading-(--text-xs--line-height) font-normal text-muted-foreground">{label}</Label>
      <SelectTrigger className="h-8 px-3 text-sm shadow-xs data-[focus-visible]:ring-offset-0"><SelectValue /></SelectTrigger>
      <SelectPopover><SelectListBox>{items.map(([id, l]) => <SelectItem key={id} id={id} textValue={l}>{l}</SelectItem>)}</SelectListBox></SelectPopover>
    </Select>
  )
}

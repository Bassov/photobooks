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
        <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
        {range ? <SliderOutput className="text-xs font-medium tabular-nums text-foreground" /> : <SliderValueField label={label} className="text-xs font-medium tabular-nums text-foreground" />}
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
    <Switch size="sm" {...props} className="w-full flex-row-reverse justify-between gap-3 text-sm font-normal">
      {children as React.ReactNode}
    </Switch>
  )
}

/* v1-style segmented control: muted track, white raised selected segment */
export function Segmented({ items, defaultValue, value, onChange, label, className, size = "md" }: {
  items: { id: string; label: React.ReactNode; aria?: string }[]; defaultValue?: string; value?: string; onChange?: (v: string) => void; label: string; className?: string; size?: "sm" | "md"
}) {
  return (
    <ToggleButtonGroup selectionMode="single" disallowEmptySelection defaultSelectedKeys={defaultValue ? [defaultValue] : undefined}
      selectedKeys={value !== undefined ? [value] : undefined} onSelectionChange={(k) => { const v = [...k][0]; if (v !== undefined) onChange?.(String(v)) }} aria-label={label}
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
  )
}

export function SelectRow({ label, items, defaultValue, value, onChange, className }: { label: string; items: [string, string][]; defaultValue?: string; value?: string; onChange?: (v: string) => void; className?: string }) {
  return (
    <Select defaultSelectedKey={defaultValue} selectedKey={value} onSelectionChange={(k) => k !== null && onChange?.(String(k))} className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <SelectTrigger className="h-8 px-3 text-sm shadow-xs data-[focus-visible]:ring-offset-0"><SelectValue /></SelectTrigger>
      <SelectPopover><SelectListBox>{items.map(([id, l]) => <SelectItem key={id} id={id} textValue={l}>{l}</SelectItem>)}</SelectListBox></SelectPopover>
    </Select>
  )
}

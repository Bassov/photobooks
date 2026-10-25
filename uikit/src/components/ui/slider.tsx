/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate; SliderThumb now forwards props (index) so range sliders work.
 */
import * as React from "react"
import {
  Slider as AriaSlider,
  SliderOutput as AriaSliderOutput,
  SliderOutputProps as AriaSliderOutputProps,
  SliderProps as AriaSliderProps,
  SliderStateContext as AriaSliderStateContext,
  SliderThumb as AriaSliderThumb,
  SliderThumbProps as AriaSliderThumbProps,
  SliderTrack as AriaSliderTrack,
  SliderTrackProps as AriaSliderTrackProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

import { labelVariants } from "./field"

const SliderOutput = ({ className, ...props }: AriaSliderOutputProps) => (
  <AriaSliderOutput className={cn(labelVariants(), className)} {...props} />
)

/** v0.8 §3.3: every slider — double-click (track, knob, label) resets to the default; while hovered or focused,
 *  ArrowUp/Right = +1 step, ArrowDown/Left = −1 step, Shift ×10, never scrolls the page. */
type V = number | number[]
const Slider = ({
  className,
  orientation = "horizontal",
  resetValue,
  ...props
}: AriaSliderProps & { resetValue?: V }) => {
  const ctl = props.value !== undefined
  const [inner, setInner] = React.useState<V>((props.defaultValue ?? props.minValue ?? 0) as V)
  const value = (ctl ? props.value : inner) as V
  const reset = React.useRef<V>((resetValue ?? props.defaultValue ?? props.value ?? props.minValue ?? 0) as V)
  if (resetValue !== undefined) reset.current = resetValue
  const live = React.useRef({ value, props, ctl })
  live.current = { value, props, ctl }
  const root = React.useRef<HTMLDivElement>(null)
  const hover = React.useRef(false)
  React.useEffect(() => {
    const el = root.current
    if (!el) return
    const commit = (v: V) => {
      const { props: p, ctl: c } = live.current
      if (p.isDisabled) return
      if (!c) setInner(v)
      p.onChange?.(v as never); p.onChangeEnd?.(v as never)
    }
    const dbl = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("input:not([type=range])")) return; e.preventDefault(); commit(reset.current) }
    const enter = () => { hover.current = true }, leave = () => { hover.current = false }
    const key = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return
      const a = document.activeElement
      const inside = !!a && el.contains(a)
      if (!inside && !hover.current) return
      if (!inside && a && a !== document.body && (a as HTMLElement).matches("input, textarea, select, [contenteditable=true]")) return
      const field = inside && (a as HTMLElement).matches("input:not([type=range])")
      if (field && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return
      const { value: v, props: p } = live.current
      if (Array.isArray(v) || p.isDisabled) return
      e.preventDefault(); e.stopImmediatePropagation()
      const st = p.step ?? 1, lo = p.minValue ?? 0, hi = p.maxValue ?? 100
      const d = (e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : -1) * st * (e.shiftKey ? 10 : 1)
      const n = Math.min(hi, Math.max(lo, Math.round((v + d) / st) * st))
      commit(+n.toFixed(6))
    }
    el.addEventListener("dblclick", dbl); el.addEventListener("pointerenter", enter); el.addEventListener("pointerleave", leave)
    window.addEventListener("keydown", key, true)
    return () => { el.removeEventListener("dblclick", dbl); el.removeEventListener("pointerenter", enter); el.removeEventListener("pointerleave", leave); window.removeEventListener("keydown", key, true) }
  }, [])
  return (
    <AriaSlider
      ref={root}
      data-reset={Array.isArray(reset.current) ? reset.current.join(",") : reset.current}
      className={composeRenderProps(className, (className) =>
        cn(
          "relative flex touch-none select-none items-center",
          {
            "h-full": orientation === "vertical",
            "w-full": orientation === "horizontal",
          },
          className
        )
      )}
      orientation={orientation}
      {...props}
      value={value}
      defaultValue={undefined}
      onChange={(v) => { if (!ctl) setInner(v as V); props.onChange?.(v as never) }}
    />
  )
}

/** v0.8: the editable value field next to a slider label (replaces the read-only output). */
const SliderValueField = ({ className, label }: { className?: string; label?: string }) => {
  const state = React.useContext(AriaSliderStateContext)!
  const [draft, setDraft] = React.useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const pct = /%/.test(state.getThumbValueLabel(0))
    let n = parseFloat(draft.replace(",", "."))
    if (Number.isFinite(n)) { if (pct) n = n / 100; state.setThumbValue(0, Math.min(state.getThumbMaxValue(0), Math.max(state.getThumbMinValue(0), n))) }
    setDraft(null)
  }
  const raw = () => { const v = state.getThumbValue(0); return /%/.test(state.getThumbValueLabel(0)) ? String(+(v * 100).toFixed(2)) : String(+v.toFixed(3)) }
  return (
    <input type="text" inputMode="decimal" aria-label={label ? `${label} value` : "Value"} data-testid="slider-value"
      value={draft ?? state.getThumbValueLabel(0)} disabled={state.isDisabled}
      onFocus={(e) => { setDraft(raw()); requestAnimationFrame(() => e.target.select()) }}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur() } if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur() } }}
      className={cn("w-16 rounded-xs bg-transparent text-right outline-hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#535152]", className)} />
  )
}

const SliderTrack = ({ className, ...props }: AriaSliderTrackProps) => (
  <AriaSliderTrack
    className={composeRenderProps(className, (className, renderProps) =>
      cn(
        {
          "h-0.75 w-full": renderProps.orientation === "horizontal",
          "h-full w-0.75": renderProps.orientation === "vertical",
        },
        "sl-track relative grow rounded-full",
        /* Disabled */
        "data-[disabled]:opacity-50",
        className
      )
    )}
    {...props}
  />
)

const SliderFillTrack = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  let state = React.useContext(AriaSliderStateContext)!
  const orientation = state.orientation === "vertical" ? "height" : "width"
  return (
    <div
      style={{ [orientation]: state.getThumbPercent(0) * 100 + "%" }}
      className={cn(
        "sl-fill absolute rounded-full",
        {
          "h-full": state.orientation === "horizontal",
          "w-full bottom-0": state.orientation === "vertical",
        },
        className
      )}
      {...props}
    />
  )
}

const SliderThumb = ({ className, ...props }: AriaSliderThumbProps) => (
  <AriaSliderThumb
    {...props}
    className={composeRenderProps(className, (className) =>
      cn(
        "sl-thumb left-1/2 top-1/2 block size-3.5 rounded-full",
        /* Disabled */
        "data-[disabled]:pointer-events-none",
        /* Focus Visible */
        "data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2",
        className
      )
    )}
  />
)

export { Slider, SliderTrack, SliderFillTrack, SliderThumb, SliderOutput, SliderValueField }

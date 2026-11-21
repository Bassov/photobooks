/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  composeRenderProps,
  type TooltipProps as AriaTooltipProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

import {
  POSITIONER,
  SCALED_EDGE,
  resolveClass,
  scaledBox,
  scaledGaps,
  useOverlayScale,
} from "./overlay-scale"

const TooltipTrigger = AriaTooltipTrigger

const TOOLTIP_BOX = "rounded-md bg-popover shadow-md"
const TOOLTIP_TEXT = "overflow-hidden px-3 py-1.5 text-sm text-popover-foreground"
const TOOLTIP_MOTION = [
  /* Entering */
  "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95",
  /* Exiting — v4.3 (G-02): no exit animation. A tooltip that closed before its enter animation finished
     could stay mounted in data-exiting (opacity 0, still role=tooltip) because animationend never fired. */
  /* Placement */
  "data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
]

/* Interface size (overlay-scale.tsx): at s ≠ 1 a zoomed box carries the paint (hairline in its 1 px
   padding) and an inner text block the padding and the consumer's classes (they set padding / type). */
const Tooltip = ({ className, offset = 4, crossOffset, containerPadding, children, ...props }: AriaTooltipProps) => {
  const s = useOverlayScale()
  const scaled = s !== 1
  return (
    <AriaTooltip
      {...scaledGaps(s, offset, crossOffset, containerPadding)}
      className={composeRenderProps(className, (className) =>
        scaled
          ? cn("z-50", POSITIONER, ...TOOLTIP_MOTION)
          : cn("z-50 border", TOOLTIP_BOX, TOOLTIP_TEXT, ...TOOLTIP_MOTION, className)
      )}
      {...props}
    >
      {scaled
        ? scaledBox(
            s,
            composeRenderProps(children, (content, values) => (
              <div className={cn(TOOLTIP_TEXT, resolveClass(className, values))}>{content}</div>
            )),
            cn(TOOLTIP_BOX, SCALED_EDGE)
          )
        : children}
    </AriaTooltip>
  )
}

export { Tooltip, TooltipTrigger }

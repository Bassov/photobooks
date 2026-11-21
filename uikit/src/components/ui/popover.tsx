/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import {
  Dialog as AriaDialog,
  DialogProps as AriaDialogProps,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
  PopoverProps as AriaPopoverProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

import { POSITIONER, SCALED_EDGE, scaledBox, scaledGaps, useOverlayScale } from "./overlay-scale"

const PopoverTrigger = AriaDialogTrigger

const POPOVER_BOX = "rounded-md bg-popover text-popover-foreground shadow-md outline-hidden"
const POPOVER_MOTION = [
  /* Entering */
  "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95",
  /* Exiting */
  "data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95",
  /* Placement */
  "data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
]

/* Interface size (overlay-scale.tsx): at s ≠ 1 the box and the consumer's classes move to a zoomed child. */
const Popover = ({ className, offset = 4, crossOffset, containerPadding, children, ...props }: AriaPopoverProps) => {
  const s = useOverlayScale()
  const scaled = s !== 1
  return (
    <AriaPopover
      {...scaledGaps(s, offset, crossOffset, containerPadding)}
      className={composeRenderProps(className, (className) =>
        scaled
          ? cn("z-50", POSITIONER, ...POPOVER_MOTION)
          : cn("z-50 border", POPOVER_BOX, ...POPOVER_MOTION, className)
      )}
      {...props}
    >
      {scaled ? scaledBox(s, children, cn(POPOVER_BOX, SCALED_EDGE), className) : children}
    </AriaPopover>
  )
}

function PopoverDialog({ className, ...props }: AriaDialogProps) {
  return (
    <AriaDialog className={cn("p-4 outline outline-0", className)} {...props} />
  )
}

export { Popover, PopoverTrigger, PopoverDialog }

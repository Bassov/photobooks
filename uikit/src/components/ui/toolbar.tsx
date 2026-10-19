/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import React from "react"
import {
  Toolbar as AriaToolbar,
  composeRenderProps,
  ToolbarProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

export function Toolbar(props: ToolbarProps) {
  return (
    <AriaToolbar
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn(
          "flex gap-2",
          /* Orientation */
          "data-[orientation=vertical]:flex-col",
          className
        )
      )}
    />
  )
}

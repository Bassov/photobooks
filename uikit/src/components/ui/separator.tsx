/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import {
  Separator as AriaSeparator,
  SeparatorProps as AriaSeparatorProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

const Separator = ({
  className,
  orientation = "horizontal",
  ...props
}: AriaSeparatorProps) => (
  <AriaSeparator
    orientation={orientation}
    className={cn(
      "bg-border",
      /* Orientation */
      orientation === "horizontal" ? "h-px w-full" : "w-px",
      className
    )}
    {...props}
  />
)

export { Separator }

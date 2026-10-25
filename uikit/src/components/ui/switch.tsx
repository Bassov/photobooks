/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import {
  Switch as AriaSwitch,
  SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

/* port addition: size="sm" (h-5 w-9) for dense inspectors */
const Switch = ({ children, className, size = "default", ...props }: AriaSwitchProps & { size?: "default" | "sm" }) => (
  <AriaSwitch
    className={composeRenderProps(className, (className) =>
      cn(
        "group inline-flex items-center gap-2 text-sm font-medium leading-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
        className
      )
    )}
    {...props}
  >
    {composeRenderProps(children, (children) => (
      <>
        <div
          className={cn(
            size === "sm" ? "h-5 w-9" : "h-6 w-11",
            "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            /* Focus Visible */
            "group-data-[focus-visible]:outline-hidden group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-ring group-data-[focus-visible]:ring-offset-2 group-data-[focus-visible]:ring-offset-background",
            /* Disabled */
            "group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50",
            /* Selected */
            "sw-track",
            /* Readonly */
            "group-data-[readonly]:cursor-default",
            /* Resets */
            "focus-visible:outline-hidden"
          )}
        >
          <div
            className={cn(
              size === "sm" ? "size-4 group-data-[selected]:translate-x-4" : "size-5 group-data-[selected]:translate-x-5",
              "sw-knob pointer-events-none block rounded-full ring-0 transition-transform",
              /* Selected */
              "translate-x-0"
            )}
          />
        </div>
        {children}
      </>
    ))}
  </AriaSwitch>
)

export { Switch }

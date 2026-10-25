/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import {
  ProgressBar as AriaProgressBar,
  ProgressBarProps as AriaProgressBarProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

import { Label, labelVariants } from "./field"

interface ProgressProps extends AriaProgressBarProps {
  barClassName?: string
  fillClassName?: string
}

const Progress = ({
  className,
  barClassName,
  fillClassName,
  children,
  ...props
}: ProgressProps) => (
  <AriaProgressBar
    className={composeRenderProps(className, (className) =>
      cn("w-full", className)
    )}
    {...props}
  >
    {composeRenderProps(children, (children, renderProps) => (
      <>
        {children}
        <div
          className={cn(
            "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
            barClassName
          )}
        >
          <div
            className={cn(
              "size-full flex-1 bg-meter transition-[color,background-color,border-color,box-shadow,opacity,transform]",
              fillClassName
            )}
            style={{
              transform: `translateX(-${100 - (renderProps.percentage || 0)}%)`,
            }}
          />
        </div>
      </>
    ))}
  </AriaProgressBar>
)

interface JollyProgressBarProps extends ProgressProps {
  label?: string
  showValue?: boolean
}

function JollyProgressBar({
  label,
  className,
  showValue = true,
  ...props
}: JollyProgressBarProps) {
  return (
    <Progress
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className)
      )}
      {...props}
    >
      {({ valueText }) => (
        <div className="flex w-full justify-between">
          <Label>{label}</Label>
          {showValue && <span className={labelVariants()}>{valueText}</span>}
        </div>
      )}
    </Progress>
  )
}

export { Progress, JollyProgressBar }
export type { ProgressProps, JollyProgressBarProps }

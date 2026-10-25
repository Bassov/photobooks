/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger } from "./tooltip"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors",
    /* Disabled */
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ",
    /* Focus Visible */
    "data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2",
    /* Resets */
    "focus-visible:outline-hidden",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground data-[hovered]:bg-primary-hover",
        /* v3 (kit): filled destructive is reserved for the confirm button INSIDE an AlertDialog.
           Everywhere else (toolbars, panels, cards) use destructive-outline / destructive-ghost. */
        destructive:
          "bg-destructive-solid text-destructive-foreground shadow-xs data-[hovered]:bg-destructive-solid-hover data-[pressed]:bg-destructive-solid-hover data-[pressed]:shadow-none data-[focus-visible]:ring-destructive/45",
        "destructive-outline":
          "border  bg-field text-destructive shadow-xs  data-[hovered]:bg-destructive/[.06] data-[pressed]:bg-destructive/[.10] data-[focus-visible]:ring-destructive/40",
        "destructive-ghost":
          "text-destructive data-[hovered]:bg-destructive/[.07] data-[pressed]:bg-destructive/[.11] data-[focus-visible]:ring-destructive/40",
        outline:
          "bg-field data-[hovered]:bg-sel data-[hovered]:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground data-[hovered]:bg-secondary/80",
        ghost: "data-[hovered]:bg-accent data-[hovered]:text-accent-foreground",
        link: "text-foreground underline decoration-foreground/35 underline-offset-4 data-[hovered]:decoration-foreground",
      },
      size: {
        /* v4.1 control scale: xs 28 · sm 32 · md 36 · lg 40 (tokens --control-*) */
        xs: "h-(--control-xs) gap-1.5 px-2 text-xs [&_svg]:size-3.5",
        sm: "h-(--control-sm) gap-1.5 px-3",
        md: "h-(--control-md) gap-2 px-4",
        lg: "h-(--control-lg) gap-2 px-4",
        default: "h-(--control-md) gap-2 px-4",
        "icon-xs": "size-(--control-xs) [&_svg]:size-3.5",
        "icon-sm": "size-(--control-sm) [&_svg]:size-4",
        icon: "size-(--control-md) [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends AriaButtonProps,
    VariantProps<typeof buttonVariants> {
  /** v4.2 (kit): why the button is disabled. With isDisabled + disabledReason the button stays focusable
   *  (aria-disabled, not disabled), ignores presses, and explains itself in a tooltip on hover / focus
   *  and via aria-describedby. */
  disabledReason?: string
}

const Button = ({ className, variant, size, disabledReason, ...props }: ButtonProps) => {
  const rid = React.useId()
  if (props.isDisabled && disabledReason) {
    const { isDisabled: _d, onPress: _p, ...rest } = props
    return (
      <TooltipTrigger delay={0}>
        <AriaButton
          aria-disabled="true"
          aria-describedby={rid}
          data-disabled-reason=""
          className={composeRenderProps(className, (className) => cn(buttonVariants({ variant, size, className }), "cursor-not-allowed opacity-50"))}
          {...rest}
        />
        {/* v4.3 (G-01): the reason lives outside the button, so the accessible name stays the visible label and the
            reason is announced once, as the description (aria-describedby resolves hidden nodes). */}
        <span id={rid} hidden>{disabledReason}</span>
        <Tooltip placement="bottom" className="whitespace-nowrap px-2 py-1 text-xs">{disabledReason}</Tooltip>
      </TooltipTrigger>
    )
  }
  return (
    <AriaButton
      className={composeRenderProps(className, (className) =>
        cn(
          buttonVariants({
            variant,
            size,
            className,
          })
        )
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }

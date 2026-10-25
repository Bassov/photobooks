/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 * Fix: MenuSection = RAC MenuSection (was ListBoxSection, crashed inside Menu).
 */
import * as React from "react"
import { VariantProps } from "class-variance-authority"
import { Check, ChevronRight, Circle } from "lucide-react"
import {
  Header as AriaHeader,
  Keyboard as AriaKeyboard,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  MenuItemProps as AriaMenuItemProps,
  MenuProps as AriaMenuProps,
  MenuTrigger as AriaMenuTrigger,
  MenuTriggerProps as AriaMenuTriggerProps,
  Separator as AriaSeparator,
  SeparatorProps as AriaSeparatorProps,
  SubmenuTrigger as AriaSubmenuTrigger,
  composeRenderProps,
  PopoverProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

import { Button, buttonVariants } from "./button"
import { ListBoxCollection } from "./list-box"
import { SelectPopover } from "./select"

const MenuTrigger = AriaMenuTrigger

const MenuSubTrigger = AriaSubmenuTrigger

// Port fix (kit): RAC 1.x needs MenuSection inside Menu — the original aliased ListBoxSection, which crashes outside a ListBox
const MenuSection = AriaMenuSection

const MenuCollection = ListBoxCollection

function MenuPopover({ className, ...props }: PopoverProps) {
  return (
    <SelectPopover
      className={composeRenderProps(className, (className) =>
        cn("w-auto", className)
      )}
      {...props}
    />
  )
}

const Menu = <T extends object>({ className, ...props }: AriaMenuProps<T>) => (
  <AriaMenu
    className={cn(
      "max-h-[inherit] overflow-auto rounded-md p-1 outline outline-0 [clip-path:inset(0_0_0_0_round_calc(var(--radius)-2px))]",
      className
    )}
    {...props}
  />
)

/* kit v3: variant="destructive" — warm red text + icon, red-tinted focus (was ad-hoc classes at call sites) */
const MenuItem = ({ children, className, variant, ...props }: AriaMenuItemProps & { variant?: "destructive" }) => (
  <AriaMenuItem
    textValue={
      props.textValue || (typeof children === "string" ? children : undefined)
    }
    className={composeRenderProps(className, (className) =>
      cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors",
        /* Disabled */
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        /* Focused */
        "data-[focused]:bg-accent data-[focused]:text-accent-foreground ",
        /* Selection Mode */
        "data-[selection-mode]:pl-8",
        variant === "destructive" && "text-destructive [&_svg]:text-destructive! data-[focused]:bg-destructive/[.08] data-[focused]:text-destructive",
        className
      )
    )}
    {...props}
  >
    {composeRenderProps(children, (children, renderProps) => (
      <>
        <span className="absolute left-2 flex size-4 items-center justify-center">
          {renderProps.isSelected && (
            <>
              {renderProps.selectionMode == "single" && (
                <Circle className="size-2 fill-current" />
              )}
              {renderProps.selectionMode == "multiple" && (
                <Check className="size-4" />
              )}
            </>
          )}
        </span>

        {children}

        {renderProps.hasSubmenu && <ChevronRight className="ml-auto size-4" />}
      </>
    ))}
  </AriaMenuItem>
)

interface MenuHeaderProps extends React.ComponentProps<typeof AriaHeader> {
  inset?: boolean
  separator?: boolean
}

const MenuHeader = ({
  className,
  inset,
  separator = true,
  ...props
}: MenuHeaderProps) => (
  <AriaHeader
    className={cn(
      "px-3 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      separator && "-mx-1 mb-1 border-b  pb-2",
      className
    )}
    {...props}
  />
)

const MenuSeparator = ({ className, ...props }: AriaSeparatorProps) => (
  <AriaSeparator
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
)

const MenuKeyboard = ({
  className,
  ...props
}: React.ComponentProps<typeof AriaKeyboard>) => {
  return (
    <AriaKeyboard
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
interface JollyMenuProps<T>
  extends AriaMenuProps<T>,
    VariantProps<typeof buttonVariants>,
    Omit<AriaMenuTriggerProps, "children"> {
  label?: string
}
function JollyMenu<T extends object>({
  label,
  children,
  variant,
  size,
  ...props
}: JollyMenuProps<T>) {
  return (
    <MenuTrigger {...props}>
      <Button variant={variant} size={size}>
        {label}
      </Button>
      <MenuPopover className="min-w-(--trigger-width)">
        <Menu {...props}>{children}</Menu>
      </MenuPopover>
    </MenuTrigger>
  )
}

export {
  MenuTrigger,
  Menu,
  MenuPopover,
  MenuItem,
  MenuHeader,
  MenuSeparator,
  MenuKeyboard,
  MenuSection,
  MenuSubTrigger,
  MenuCollection,
  JollyMenu,
}
export type { MenuHeaderProps, JollyMenuProps }

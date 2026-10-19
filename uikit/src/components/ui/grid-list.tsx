/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import { GripHorizontal } from "lucide-react"
import {
  Button as AriaButton,
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  GridListItemProps as AriaGridListItemProps,
  GridListProps as AriaGridListProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { Checkbox } from "./checkbox"

export function GridList<T extends object>({
  children,
  ...props
}: AriaGridListProps<T>) {
  return (
    <AriaGridList
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn(
          "jolly-GridList group flex flex-col gap-2 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
          /* Empty */
          "data-[empty]:p-6 data-[empty]:text-center data-[empty]:text-sm",
          className
        )
      )}
    >
      {children}
    </AriaGridList>
  )
}

export function GridListItem({
  children,
  className,
  ...props
}: AriaGridListItemProps) {
  let textValue = typeof children === "string" ? children : undefined
  return (
    <AriaGridListItem
      textValue={textValue}
      className={composeRenderProps(className, (className) =>
        cn(
          "jolly-GridListItem relative flex w-full cursor-default select-none items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-hidden",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Focus Visible */
          "data-[focus-visible]:z-10 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-background",
          /* Hovered */
          "data-[hovered]:bg-accent data-[hovered]:text-accent-foreground",
          /* Selected */
          "data-[selected]:bg-accent data-[selected]:text-accent-foreground",
          /* Dragging */
          "data-[dragging]:opacity-60",
          className
        )
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {/* Add elements for drag and drop and selection. */}
          {renderProps.allowsDragging && (
            <AriaButton slot="drag">
              <GripHorizontal className="size-4" />
            </AriaButton>
          )}
          {renderProps.selectionMode === "multiple" &&
            renderProps.selectionBehavior === "toggle" && (
              <Checkbox slot="selection" />
            )}
          {children}
        </>
      ))}
    </AriaGridListItem>
  )
}

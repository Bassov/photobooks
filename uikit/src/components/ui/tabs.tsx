/**
 * Ported from JollyUI (https://github.com/jolbol1/jolly-ui, src/registry/default/ui, MIT —
 * see LICENSE-jollyui-MIT.txt). Ported to Tailwind v4 / React 19 / react-aria-components 1.22
 * on 2026-10-16. The code is owned by this repo from here on.
 * Port notes: v4 class renames (outline-none→outline-hidden, shadow-sm→shadow-xs,
 * [--var]→(--var)), "use client" dropped, tw-animate-css instead of tailwindcss-animate.
 */
import * as React from "react"
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel,
  TabPanelProps as AriaTabPanelProps,
  TabProps as AriaTabProps,
  Tabs as AriaTabs,
  TabsProps as AriaTabsProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: AriaTabsProps) {
  return (
    <AriaTabs
      className={composeRenderProps(className, (className) =>
        cn(
          "group flex flex-col gap-2",
          /* Orientation */
          "data-[orientation=vertical]:flex-row",
          className
        )
      )}
      {...props}
    />
  )
}

/*
 * v3 (kit): the track and the tab share one geometry, so call sites no longer hand-tune heights.
 *  - TabList `size`: sm 28 / md 32 (app default) / lg 40 (JollyUI default). The track has an equal
 *    3px inset on every side (2px for sm) and the tabs stretch to fill it (items-stretch), so the
 *    selected pill can never sit flush to one edge.
 *  - Tab content is a single centred flex row (items-center, leading-none): icon, label and
 *    <TabCount> share one optical centre line. Font size is inherited from the list.
 *  - Nested radius: tab radius = track radius − inset.
 */
const tabListSizes = {
  sm: "h-7 p-[2px] gap-px rounded-md text-xs *:px-2 *:rounded-[5px]",
  md: "h-8 p-[3px] gap-0.5 rounded-lg text-[13px] *:px-2.5 *:rounded-[6px]",
  lg: "h-10 p-1 gap-1 rounded-lg text-sm *:px-3 *:rounded-[6px]",
} as const

const TabList = <T extends object>({
  className,
  size = "md",
  ...props
}: AriaTabListProps<T> & { size?: keyof typeof tabListSizes }) => (
  <AriaTabList
    className={composeRenderProps(className, (className) =>
      cn(
        "inline-flex items-stretch justify-center bg-muted text-muted-foreground dark:bg-black/25",
        tabListSizes[size],
        /* Orientation */
        "data-[orientation=vertical]:h-auto data-[orientation=vertical]:flex-col",
        className
      )
    )}
    {...props}
  />
)

const Tab = ({ className, ...props }: AriaTabProps) => (
  <AriaTab
    className={composeRenderProps(className, (className) =>
      cn(
        "group/tab inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-medium leading-none outline-hidden ring-offset-background transition-[color,background-color,box-shadow] duration-150",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        /* Hovered */
        "data-[hovered]:text-foreground",
        /* Focus Visible */
        "data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-1",
        /* Disabled */
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        /* Selected */
        "data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-[0_1px_2px_rgb(20_20_19/.08),0_0_0_.5px_rgb(20_20_19/.06)] dark:data-[selected]:bg-accent dark:data-[selected]:shadow-[0_1px_2px_rgb(0_0_0/.4)]",
        /* Orientation */
        "group-data-[orientation=vertical]:w-full",
        className
      )
    )}
    {...props}
  />
)

/* Small muted count inside a Tab: tabular figures in a subtle pill, aligned to the label's centre line. */
const TabCount = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      "-my-px inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/[.06] px-[5px] text-[10.5px] font-medium tabular-nums leading-none text-muted-foreground",
      "group-data-[selected]/tab:bg-foreground/[.07] group-data-[selected]/tab:text-foreground/70 dark:bg-white/[.07] dark:group-data-[selected]/tab:bg-white/10",
      className
    )}
  >
    {children}
  </span>
)

const TabPanel = ({ className, ...props }: AriaTabPanelProps) => (
  <AriaTabPanel
    className={composeRenderProps(className, (className) =>
      cn(
        "mt-2 ring-offset-background",
        /* Focus Visible */
        "data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2",
        className
      )
    )}
    {...props}
  />
)

export { Tabs, TabList, TabPanel, Tab, TabCount }

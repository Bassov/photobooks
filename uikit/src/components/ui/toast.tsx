/**
 * Toast — JollyUI has no toast, so this follows the React Aria Tailwind Starter Toast recipe
 * (Apache-2.0, see LICENSE-react-spectrum-Apache-2.0.txt): RAC UNSTABLE_ToastRegion/Toast/ToastQueue
 * + view-transition. Restyled to the JollyUI/shadcn look (popover surface, 1px border, shadow-lg,
 * rounded-lg, ghost close button) and extended with an icon, a tone and an optional action.
 */
import * as React from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  UNSTABLE_ToastRegion as AriaToastRegion,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastContent as AriaToastContent,
  type ToastRegionProps,
  Button as AriaButton,
  Text,
} from "react-aria-components"
import { flushSync } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import "./toast.css"

export interface ToastContent {
  title: string
  description?: string
  tone?: "default" | "success" | "error"
  icon?: ReactNode
  action?: { label: string; onAction?: () => void }
}

export function createToastQueue() {
  return new ToastQueue<ToastContent>({
    wrapUpdate(fn) {
      if ("startViewTransition" in document) document.startViewTransition(() => flushSync(fn))
      else fn()
    },
  })
}

export function ToastRegion({ className, ...props }: Omit<ToastRegionProps<ToastContent>, "children"> & { className?: string }) {
  return (
    <AriaToastRegion
      {...props}
      className={cn("fixed z-50 flex flex-col-reverse gap-2 rounded-lg outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring", className)}
    >
      {({ toast }) => {
        const c = toast.content
        return (
          <AriaToast
            toast={toast}
            style={{ viewTransitionName: toast.key } as CSSProperties}
            className={cn(
              "group/toast relative flex w-full items-start gap-3 rounded-lg border bg-popover p-3.5 pr-10 text-popover-foreground shadow-lg outline-hidden [view-transition-class:toast]",
              "data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2 ring-offset-background",
              c.tone === "error" && "border-destructive/30",
            )}
          >
            {c.icon && (
              <span className={cn("mt-px shrink-0 [&>svg]:size-4",
                c.tone === "error" ? "text-destructive" : c.tone === "success" ? "text-success" : "text-muted-foreground")}>{c.icon}</span>
            )}
            <AriaToastContent className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Text slot="title" className="text-sm font-semibold leading-snug">{c.title}</Text>
              {c.description && <Text slot="description" className="text-[13px] leading-snug text-muted-foreground">{c.description}</Text>}
              {c.action && (
                <div className="mt-2.5">
                  <AriaButton onPress={c.action.onAction}
                    className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground outline-hidden ring-offset-background data-[hovered]:bg-primary/90 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2">
                    {c.action.label}
                  </AriaButton>
                </div>
              )}
            </AriaToastContent>
            <AriaButton slot="close" aria-label="Close"
              className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-hidden data-[hovered]:bg-accent data-[hovered]:text-accent-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
              <X className="size-4" />
            </AriaButton>
          </AriaToast>
        )
      }}
    </AriaToastRegion>
  )
}

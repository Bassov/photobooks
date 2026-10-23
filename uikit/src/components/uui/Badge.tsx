/**
 * Adapted from Untitled UI React — components/base/badges/badges.tsx (MIT, untitleduico/react).
 * Kept: the color × size × type API ("pill-color" / "badge-color") and the icon slot.
 * v3 (kit v3): calm, premium palette — low-chroma tint over the surface, a hairline *inset* ring
 * instead of a hard border, AA text (≥ 5:1), optional status dot, medium weight,
 * tabular numbers. Colours live in index.css (--badge-<tone>-fg/bg/ring/dot, per theme; .pb-badge).
 *
 * Usage rule: status → `dot`; an icon only when it adds meaning beyond colour (lock, link, check).
 * `brand` is the quiet slate "info" tone (parent / override / source tags), not a filled black pill.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Color = "gray" | "brand" | "success" | "warning" | "error"
const sizes = {
  sm: "h-5 gap-1 px-1.5 text-[11px] [&>svg]:size-3",
  md: "h-6 gap-1.5 px-2 text-xs [&>svg]:size-3",
  lg: "h-7 gap-1.5 px-2.5 text-[13px] [&>svg]:size-3.5",
}
const pad = { sm: "pl-[5px]", md: "pl-1.5", lg: "pl-2" } // a dot reads as part of the padding: pull it in optically

export function Badge({ color = "gray", size = "sm", type = "badge-color", icon, dot, children, className }: {
  color?: Color; size?: keyof typeof sizes; type?: "pill-color" | "badge-color"; icon?: ReactNode; dot?: boolean; children: ReactNode; className?: string
}) {
  return (
    <span data-color={color} className={cn(
      "pb-badge inline-flex w-max shrink-0 items-center whitespace-nowrap font-medium leading-none tracking-[0.01em] tabular-nums [&>svg]:shrink-0",
      type === "pill-color" ? "rounded-full" : size === "lg" ? "rounded-[7px]" : "rounded-[6px]",
      sizes[size], dot && pad[size], className,
    )}>
      {dot && <span aria-hidden className={cn("pb-badge-dot shrink-0 rounded-full", size === "lg" ? "size-1.5" : "size-[5px]")} />}
      {icon}{children}
    </span>
  )
}

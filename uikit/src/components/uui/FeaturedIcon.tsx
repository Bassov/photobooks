/**
 * Adapted from Untitled UI React — components/foundations/featured-icon/featured-icon.tsx (MIT, untitleduico/react).
 * Kept: color / size / theme API.
 * v3: restyled to the JollyUI/shadcn look — "light" is a rounded-lg tile with a hairline border and
 * shadow-xs (like a shadcn empty-state icon), "outline" adds two soft concentric hairlines.
 * kit v3: "soft" = Untitled UI's own "light" look — a round, low-chroma tinted disc with a hairline
 * inset ring (used by AlertDialog and status cards).
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Color = "gray" | "brand" | "success" | "warning" | "error"
const fg: Record<Color, string> = {
  gray: "text-foreground", brand: "text-foreground",
  success: "text-success", warning: "text-warning", error: "text-destructive",
}
const soft: Record<Color, string> = {
  gray: "bg-foreground/[.05] text-foreground/80 ring-foreground/[.06]", brand: "bg-foreground/[.05] text-foreground ring-foreground/[.06]",
  success: "bg-success/10 text-success ring-success/15", warning: "bg-warning/12 text-warning ring-warning/18", error: "bg-destructive/10 text-destructive ring-destructive/15",
}
const sizes = { sm: "size-8 rounded-md [&>svg]:size-4", md: "size-10 rounded-lg [&>svg]:size-[18px]", lg: "size-12 rounded-lg [&>svg]:size-5", xl: "size-14 rounded-xl [&>svg]:size-6" }

export function FeaturedIcon({ color = "gray", size = "md", theme = "light", children, className }: {
  color?: Color; size?: keyof typeof sizes; theme?: "light" | "outline" | "soft"; children: ReactNode; className?: string
}) {
  if (theme === "soft") return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full! ring-1 ring-inset", sizes[size], soft[color], className)}>{children}</span>
  )
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center border", theme === "outline" ? "bg-muted shadow-none" : "bg-background shadow-xs", sizes[size], fg[color], className)}
    >
      {children}
    </span>
  )
}

/* Settings → Hosting: the bits the manual form (hosting.tsx) and the guided setup (hostingSetup.tsx) share. */
import * as React from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { ERR } from "./printProfiles"

export const OUTLINE = "px-3 text-sm shadow-xs data-[hovered]:bg-accent"
export const GHOST = "px-3 text-sm data-[hovered]:bg-accent"
export function when(ms: number) {
  const d = new Date(ms), now = new Date()
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === now.toDateString()) return `today at ${t}`
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })} at ${t}`
}
/** Both labels sit in one grid cell, so the button keeps its width (the D36 Share rule). */
export function Swap({ on, rest, busy }: { on: boolean; rest: React.ReactNode; busy: React.ReactNode }) {
  return (
    <span className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span className={cn("flex items-center justify-center gap-1.5", on && "invisible")}>{rest}</span>
      <span className={cn("flex items-center justify-center gap-1.5", !on && "invisible")}>{busy}</span>
    </span>
  )
}
export const checkingLabel = <><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />Checking…</>
export const Fail = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 text-sm" style={{ color: ERR }} role="alert" data-testid="hosting-error"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{children}</div>
)

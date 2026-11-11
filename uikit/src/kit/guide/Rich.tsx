import { cn } from "@/lib/utils"
import { Kbd } from "@/components/app/ui"

/** Guide copy markup: `key` → Kbd, *text* → italic, **text** → bold. Everything else is plain text. */
export function Rich({ text }: { text: string }) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/).map((t, i) =>
    t.startsWith("`") ? <Kbd key={i} className="mx-px align-[1px]">{t.slice(1, -1)}</Kbd>
    : t.startsWith("**") ? <b key={i} className="font-semibold">{t.slice(2, -2)}</b>
    : t.startsWith("*") && t.length > 2 ? <i key={i}>{t.slice(1, -1)}</i>
    : t)
}

const dot = "size-1.5 shrink-0 rounded-full"

/** "In the app" (filled) or "Coming · <roadmap slug>" (outlined, hollow dot). */
export function StatusChip({ coming, short, className }: { coming?: string; short?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-2xs font-medium leading-none",
      coming ? "text-muted-foreground ring-1 ring-inset ring-neutral-400" : "bg-field text-foreground", className)} data-status={coming ? "coming" : "app"}>
      <span className={cn(dot, coming ? "ring-1 ring-inset ring-neutral-500" : "bg-foreground")} />
      {coming ? (short ? "Coming" : `Coming · ${coming}`) : "In the app"}
    </span>
  )
}

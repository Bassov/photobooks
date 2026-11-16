import * as React from "react"
import { Segmented } from "@/components/app/controls"
import { cn } from "@/lib/utils"
import { imposition, type ImposedSlot, type ImpositionLayout } from "./imposition"
import { ASSEMBLY, LAYOUTS, PAGE_COUNTS, PRINT_NOTES } from "./content"
import { Rich } from "./Rich"

const eyebrow = "text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
const ink = { fill: "none", stroke: "#393738", strokeWidth: 1.5 } as const
const paper = { ...ink, fill: "#FBFAF7" } as const

/** Assembly pictograms, in ASSEMBLY order (Designer spec). */
const PICTOS = [
  <svg key="print" viewBox="0 0 150 72" className="h-full"><rect x="45" y="20" width="60" height="34" rx="3" {...ink} /><rect x="55" y="10" width="40" height="12" {...paper} /><path d="M60 58h30" {...ink} /><path d="M112 22a14 14 0 0 1 0 22m-4-4 4 4 4-4" {...ink} /></svg>,
  <svg key="cut" viewBox="0 0 150 72" className="h-full"><rect x="45" y="12" width="60" height="48" {...paper} /><path d="M38 36h74" stroke="#393738" strokeWidth={1.5} strokeDasharray="4 3" /><path d="M114 36l8-6v12z" fill="#393738" /></svg>,
  <svg key="stack" viewBox="0 0 150 72" className="h-full"><rect x="56" y="10" width="52" height="34" {...paper} /><rect x="50" y="19" width="52" height="34" {...paper} /><rect x="44" y="28" width="52" height="34" {...paper} /></svg>,
  <svg key="staple" viewBox="0 0 150 72" className="h-full"><rect x="40" y="14" width="70" height="46" {...paper} /><path d="M75 14v46" stroke="#A6A6A6" strokeDasharray="3 2" /><path d="M75 24v8M75 42v8" stroke="#393738" strokeWidth={3} /></svg>,
  <svg key="trim" viewBox="0 0 150 72" className="h-full"><path d="M50 14h46l6 46H50z" {...paper} /><path d="M98 8v58" {...ink} strokeDasharray="4 3" /><path d="M106 30l8-6v20z" fill="#393738" /></svg>,
]

/** One side of a sheet: a 74 × 52 half per saddle sheet (4-up stacks two, with the cut line between). */
function Face({ slots, side, rows }: { slots: ImposedSlot[]; side: "front" | "back"; rows: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex w-[74px] flex-col bg-[#FBFAF7] shadow-thumb" data-face={side}>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="relative grid h-[52px] grid-cols-2">
            {slots.slice(row * 2, row * 2 + 2).map((p, i) => p === null
              ? <span key={i} className="grid place-items-center bg-[repeating-linear-gradient(135deg,rgb(0_0_0/.05)_0_1px,transparent_1px_5px)] text-2xs font-normal text-neutral-400" data-page="blank">blank</span>
              : <span key={i} className="grid place-items-center text-sm font-semibold tabular-nums text-foreground" data-page={p}>{p}</span>)}
            <span aria-hidden className="absolute inset-y-0 left-1/2 border-l border-dashed border-neutral-400" />
          </div>
        ))}
        {rows > 1 && <span aria-hidden data-cut className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#A6A6A6]" />}
      </div>
      <span className="text-2xs text-slate-500">{side}</span>
    </div>
  )
}

/** Chapter 16: sheets in folding order (prod `imposition()`) for a chosen layout and page count, then the five assembly steps. */
export function Imposition() {
  const [layout, setLayout] = React.useState<ImpositionLayout>("2up")
  const [count, setCount] = React.useState(PAGE_COUNTS[0])
  const { sheets, blanks, rows } = imposition(count, layout)
  return (
    <div className="mt-6 rounded-lg bg-field px-5 pb-5.5 pt-5" data-testid="guide-imposition">
      <div className="flex items-center gap-4">
        <Segmented label="Layout" size="md" className="w-[140px] bg-[#CBCBCB]" value={layout} onChange={(v) => setLayout(v as ImpositionLayout)}
          items={LAYOUTS.map((l) => ({ id: l.id, label: l.label }))} />
        <Segmented label="Pages" size="md" className="w-[220px] bg-[#CBCBCB]" value={String(count)} onChange={(v) => setCount(Number(v))}
          items={PAGE_COUNTS.map((n) => ({ id: String(n), label: String(n) }))} />
        <p className="text-sm text-muted-foreground" data-testid="guide-imposition-summary" aria-live="polite">
          <b className="font-semibold text-foreground">{count} pages</b>{blanks ? ` + ${blanks} blank` : ""} → {sheets.length} sheets, printed on both sides{layout === "4up" ? ", cut across" : ""}
        </p>
      </div>
      <ol className="mt-4.5 flex min-h-[206px] flex-wrap content-start gap-3" aria-label="Sheets in folding order">
        {sheets.map((s, i) => (
          <li key={i} className="flex flex-col gap-1.5" data-sheet={i + 1}>
            <span className="text-xs text-muted-foreground"><b className="font-semibold text-foreground">Sheet {i + 1}</b>{layout === "4up" ? "" : i === 0 ? " · outside" : i === sheets.length - 1 ? " · middle" : ""}</span>
            <div className="flex gap-1.5"><Face slots={s.front} side="front" rows={rows} /><Face slots={s.back} side="back" rows={rows} /></div>
          </li>
        ))}
      </ol>
      <ol className="mt-6 grid grid-cols-5 gap-3" data-testid="guide-assembly">
        {ASSEMBLY.map((a, i) => {
          const skip = a.only !== undefined && a.only !== layout
          return (
            <li key={a.title} className={cn("flex flex-col gap-1", skip && "opacity-50")} data-skip={skip || undefined}>
              <div className="mb-1 grid h-[72px] place-items-center rounded-lg bg-chrome" aria-hidden>{PICTOS[i]}</div>
              <b className="text-sm font-semibold">{i + 1} · {a.title}</b>
              <span className="text-sm text-muted-foreground"><Rich text={a.text} /></span>
            </li>
          )
        })}
      </ol>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {PRINT_NOTES.map((n) => (
          <div key={n.title} className="rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset ring-border">
            <div className={eyebrow}>{n.title}</div>
            {n.text}
          </div>
        ))}
      </div>
    </div>
  )
}

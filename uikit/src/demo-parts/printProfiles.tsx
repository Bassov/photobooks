/* printer-presets (Designer spec 2026-11-05): the kit's print profiles — a sample catalog, the custom-profile helpers and the
   profile editor dialog. The kit never imports src/: `KitProfile` is the subset of core `PrintProfile` the editor shows (D2). */
import * as React from "react"
import { Button } from "@/components/ui/button"
import { AppModal } from "@/components/app/ui"
import { cn } from "@/lib/utils"
import { fmtN } from "@/sandbox/v7"

export type SpineRule = { kind: "formula"; baseMm: number; perPageMm: number } | { kind: "table"; rows: { maxPages: number; widthMm: number }[] }
export type KitProfile = {
  id: string; name: string
  /** name of the profile this one was made from (the editor's "Based on …") */ base: string
  trimMinMm: number; trimMaxMm: number; bleedMinMm: number; bleedMaxMm: number; safeMarginMm: number
  pageCount: { min: number; step: number; max: number }
  spine: SpineRule; coverWrapMm: number; coverHingeMm: number
  dpi: { warn: number; min: number }
}

export const GENERIC_ID = "generic"
/* SAMPLE DATA (D8): only Generic mirrors core `genericPrintProfile()`. The shop numbers are layout placeholders except the
   Lulu bleed / safe margin / ppi the spec verified; printer-presets-core ships the sourced values (`source` / `checked`). */
export const CATALOG: KitProfile[] = [
  { id: GENERIC_ID, name: "Generic", base: "Generic", trimMinMm: 50, trimMaxMm: 500, bleedMinMm: 0, bleedMaxMm: 10, safeMarginMm: 5,
    pageCount: { min: 20, step: 2, max: 120 }, spine: { kind: "formula", baseMm: 2, perPageMm: 0.1 }, coverWrapMm: 15, coverHingeMm: 8, dpi: { warn: 200, min: 150 } },
  { id: "lulu-photo-book", name: "Lulu · Photo book", base: "Lulu · Photo book", trimMinMm: 152, trimMaxMm: 305, bleedMinMm: 3.175, bleedMaxMm: 3.175, safeMarginMm: 12.7,
    pageCount: { min: 24, step: 2, max: 240 }, spine: { kind: "formula", baseMm: 8, perPageMm: 0.2 }, coverWrapMm: 15, coverHingeMm: 8, dpi: { warn: 300, min: 150 } },
  { id: "saal-photo-book", name: "Saal Digital · Photo Book", base: "Saal Digital · Photo Book", trimMinMm: 100, trimMaxMm: 450, bleedMinMm: 3, bleedMaxMm: 3, safeMarginMm: 10,
    pageCount: { min: 26, step: 2, max: 130 }, spine: { kind: "table", rows: [{ maxPages: 50, widthMm: 7 }, { maxPages: 90, widthMm: 10 }, { maxPages: 130, widthMm: 13 }] },
    coverWrapMm: 15, coverHingeMm: 8, dpi: { warn: 250, min: 150 } },
]
/** the kit's sample custom profile (a Lulu copy with a wider bleed and safe margin) */
export const SAMPLE_CUSTOMS: KitProfile[] = [{ ...CATALOG[1], id: "custom-lulu-copy", name: "Lulu · Photo book (copy)", bleedMinMm: 5, bleedMaxMm: 5, safeMarginMm: 15 }]

/** D6 resolution: built-in id → custom id → Generic. */
export const profileById = (id: string | undefined, customs: KitProfile[]) => CATALOG.find((p) => p.id === id) ?? customs.find((p) => p.id === id) ?? CATALOG[0]
/** The bleed a book gets with this profile: the profile's one value, or the 3 mm default inside a range (Generic 0–10). */
export const profileBleed = (p: KitProfile) => Math.min(Math.max(3, p.bleedMinMm), p.bleedMaxMm)
export const spineWidth = (s: SpineRule, pages: number) => s.kind === "formula" ? s.baseMm + s.perPageMm * pages : (s.rows.find((r) => r.maxPages >= pages) ?? s.rows[s.rows.length - 1]).widthMm
export function profileSummary(p: KitProfile) {
  const bleed = p.bleedMinMm === p.bleedMaxMm ? fmtN(p.bleedMinMm) : `${fmtN(p.bleedMinMm)}–${fmtN(p.bleedMaxMm)}`
  return `${fmtN(p.trimMinMm / 10)}–${fmtN(p.trimMaxMm / 10)} cm · bleed ${bleed} mm · safe ${fmtN(p.safeMarginMm)} mm · ${p.pageCount.min}–${p.pageCount.max} pages · photos ≥ ${p.dpi.warn} ppi`
}
/** D9: "<name> (copy)", then "(copy 2)", "(copy 3)" … */
export function copyName(name: string, taken: string[]) {
  const root = name.replace(/ \(copy(?: \d+)?\)$/, "")
  for (let n = 1; ; n++) { const c = `${root} (copy${n > 1 ? ` ${n}` : ""})`; if (!taken.includes(c)) return c }
}
export const copyOf = (p: KitProfile, taken: string[]): KitProfile => ({ ...p, id: `custom-${Date.now().toString(36)}`, name: copyName(p.name, taken), base: p.name })
export const newProfile = (): KitProfile => ({ ...CATALOG[0], id: `custom-${Date.now().toString(36)}`, name: "New profile", base: "Generic" })

/* ---------------------------------------------------------------- editor */
const NUM = ["trimMin", "trimMax", "bleed", "safe", "pMin", "pMax", "pStep", "spineBase", "spinePer", "wrap", "hinge", "dpiWarn", "dpiMin"] as const
type NumKey = (typeof NUM)[number]
export type Draft = { name: string } & Record<NumKey, string>
type Key = keyof Draft
/** may be 0 (everything else must be above 0) */
const ZERO_OK = new Set<Key>(["bleed", "safe", "spineBase", "wrap", "hinge"])
const WHOLE = new Set<Key>(["pMin", "pMax", "pStep"])

export function toDraft(p: KitProfile): Draft {
  const s = p.spine.kind === "formula" ? p.spine : { baseMm: 0, perPageMm: 0 }
  const v = { trimMin: p.trimMinMm, trimMax: p.trimMaxMm, bleed: profileBleed(p), safe: p.safeMarginMm, pMin: p.pageCount.min, pMax: p.pageCount.max, pStep: p.pageCount.step,
    spineBase: s.baseMm, spinePer: s.perPageMm, wrap: p.coverWrapMm, hinge: p.coverHingeMm, dpiWarn: p.dpi.warn, dpiMin: p.dpi.min }
  return { name: p.name, ...Object.fromEntries(NUM.map((k) => [k, fmtN(v[k])])) } as Draft
}
const num = (s: string) => (s.trim() === "" ? NaN : Number(s))
/** Editor rules (spec §Profile editor): one message per field, in the spec's words. A table spine has no fields to check. */
export function profileIssues(d: Draft, table = false): Partial<Record<Key, string>> {
  const out: Partial<Record<Key, string>> = {}
  if (!d.name.trim()) out.name = "Give the profile a name."
  for (const k of NUM) {
    if (table && (k === "spineBase" || k === "spinePer")) continue
    const v = num(d[k])
    if (!Number.isFinite(v) || v < 0 || (v === 0 && !ZERO_OK.has(k)) || (WHOLE.has(k) && !Number.isInteger(v))) out[k] = "Enter a number above 0."
  }
  const n = (k: NumKey) => (out[k] ? NaN : num(d[k]))
  if (n("trimMax") < n("trimMin")) out.trimMax = "The largest side can’t be smaller than the smallest."
  const [min, max, step] = [n("pMin"), n("pMax"), n("pStep")]
  if (step % 2 === 1) out.pStep = "Pages come in spreads: the step must be even."
  else if ([min, max, step].every(Number.isFinite) && (max < min || (max - min) % step !== 0)) {
    const a = min + Math.max(0, Math.floor((max - min) / step)) * step
    out.pMax = `${min} to ${max} isn’t whole steps of ${step}. Try ${a} or ${a + step}.`
  }
  if (n("dpiMin") > n("dpiWarn")) out.dpiMin = "Minimum can’t be above Warn under."
  return out
}
export function fromDraft(base: KitProfile, d: Draft): KitProfile {
  const v = (k: NumKey) => num(d[k])
  return { ...base, name: d.name.trim(), trimMinMm: v("trimMin"), trimMaxMm: v("trimMax"), bleedMinMm: v("bleed"), bleedMaxMm: v("bleed"), safeMarginMm: v("safe"),
    pageCount: { min: v("pMin"), step: v("pStep"), max: v("pMax") }, spine: base.spine.kind === "table" ? base.spine : { kind: "formula", baseMm: v("spineBase"), perPageMm: v("spinePer") },
    coverWrapMm: v("wrap"), coverHingeMm: v("hinge"), dpi: { warn: v("dpiWarn"), min: v("dpiMin") } }
}

const ERR = "#a8403a"
const BOX = "flex h-8 items-center rounded-md bg-field px-2.5 text-sm text-foreground"
/* kit Field rule: shadow-xs at rest; focus-visible and error are a 1 px inset ring instead */
const ring = (err: boolean) => err ? "shadow-none ring-1 ring-inset ring-[#a8403a]" : "shadow-xs has-[input:focus-visible]:shadow-none has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-[#535152]"
const input = "min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
const GROUP = "col-span-2 mt-3 text-2xs font-semibold uppercase leading-[14.84px] tracking-[.12em] text-muted-foreground"

/** Profile editor (spec §Profile editor): `mode` "new" = New profile (not in the list until Save), "edit" = an existing custom profile. */
export function PrintProfileDialog({ profile, mode, initialDraft, onSave, onCancel }: {
  profile: KitProfile; mode: "new" | "edit"; initialDraft?: Partial<Draft>; onSave: (p: KitProfile) => void; onCancel: () => void
}) {
  const [d, setD] = React.useState<Draft>(() => ({ ...toDraft(profile), ...initialDraft }))
  const table = profile.spine.kind === "table"
  const issues = profileIssues(d, table)
  const valid = Object.keys(issues).length === 0
  const save = () => { if (valid) onSave(fromDraft(profile, d)) }
  const field = (k: NumKey, unit?: string, w = 96) => (
    <label className={cn(BOX, "shrink-0 gap-1.5", ring(!!issues[k]))} style={{ width: w }} data-testid={`pp-${k}`}>
      <input aria-label={LABELS[k]} aria-invalid={!!issues[k] || undefined} inputMode="decimal" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={cn(input, "font-mono tabular-nums")} />
      {unit && <span className="shrink-0 text-muted-foreground">{unit}</span>}
    </label>
  )
  const msg = (...ks: Key[]) => { const m = ks.map((k) => issues[k]).find(Boolean); return m && <div className="col-start-2 -mt-0.5 text-xs leading-[16.8px]" style={{ color: ERR }} data-testid="pp-error">{m}</div> }
  const row = (label: string, ctl: React.ReactNode, ...ks: Key[]) => <><div className="text-sm text-muted-foreground">{label}</div><div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">{ctl}</div>{msg(...ks)}</>
  const [pMin, pMax] = [num(d.pMin), num(d.pMax)]
  const spine = fromDraft(profile, d).spine
  const pagesOk = !issues.pMin && !issues.pMax && !issues.pStep && !issues.spineBase && !issues.spinePer
  const w = (n: number) => fmtN(spineWidth(spine, n))
  return (
    <AppModal isOpen width={560} onOpenChange={(o) => { if (!o) onCancel() }} className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden bg-chrome">
      <div className="flex min-h-0 flex-col px-6 py-5" data-testid="print-profile-dialog" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); save() } }}>
        <div className="heading text-xl leading-tight">{mode === "new" ? "New print profile" : "Edit print profile"}</div>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="pp-sub">Based on {profile.base}.{mode === "edit" && " Books that use this profile follow your changes."}</p>
        <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-auto px-1">
          <div className="grid grid-cols-[132px_1fr] items-center gap-x-3 gap-y-2" data-testid="pp-form">
            <div className="text-sm text-muted-foreground">Name</div>
            <label className={cn(BOX, "w-full", ring(!!issues.name))} data-testid="pp-name"><input aria-label="Name" aria-invalid={!!issues.name || undefined} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={input} /></label>
            {msg("name")}
            <div className={GROUP}>Page</div>
            {row("Page side", <>{field("trimMin", "mm")}to{field("trimMax", "mm")}</>, "trimMin", "trimMax")}
            {row("Bleed", field("bleed", "mm"), "bleed")}
            {row("Safe margin", field("safe", "mm"), "safe")}
            <div className={GROUP}>Pages</div>
            {row("Page count", <>{field("pMin")}to{field("pMax")}in steps of{field("pStep", undefined, 64)}</>, "pMin", "pMax", "pStep")}
            <div className={GROUP}>Spine and cover</div>
            {table
              ? row("Spine", <span className="text-foreground" data-testid="pp-spine-table">From the {profile.base} table · {pagesOk ? `${w(pMin)}–${w(pMax)}` : "–"} mm</span>)
              : row("Spine", <>{field("spineBase", "mm")}+{field("spinePer", "mm")}per page</>, "spineBase", "spinePer")}
            {!table && pagesOk && <div className="col-start-2 -mt-0.5 text-xs leading-[16.8px] text-muted-foreground" data-testid="pp-spine-hint">{pMin} pages = {w(pMin)} mm · {pMax} pages = {w(pMax)} mm</div>}
            {row("Wrap · hinge", <>{field("wrap", "mm")}{field("hinge", "mm")}</>, "wrap", "hinge")}
            <div className={GROUP}>Photo quality</div>
            {row("Warn under", field("dpiWarn", "ppi"), "dpiWarn")}
            {row("Minimum", field("dpiMin", "ppi"), "dpiMin")}
          </div>
        </div>
        <div className="mt-5 flex shrink-0 justify-end gap-2">
          <Button variant="ghost" size="md" className="px-4" onPress={onCancel}>Cancel</Button>
          <Button size="md" className="px-4" isDisabled={!valid} onPress={save} data-testid="pp-save">Save</Button>
        </div>
      </div>
    </AppModal>
  )
}
const LABELS: Record<NumKey, string> = { trimMin: "Smallest page side", trimMax: "Largest page side", bleed: "Bleed", safe: "Safe margin", pMin: "Fewest pages", pMax: "Most pages", pStep: "Page step",
  spineBase: "Spine base", spinePer: "Spine per page", wrap: "Cover wrap", hinge: "Cover hinge", dpiWarn: "Warn under", dpiMin: "Minimum" }

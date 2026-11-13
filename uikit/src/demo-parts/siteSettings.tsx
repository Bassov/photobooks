/* Settings → Site (Designer spec site-settings § Spec): Site title, Author, Intro and Theme, edited in place and saved on
   commit (S2: blur / Enter; Esc reverts and keeps focus). Field rows are the Hosting field row in Inter 13; the Theme is
   two miniature tiles with the layout-tile states (M82). */
import * as React from "react"
import { cn } from "@/lib/utils"
import type { SiteTexts } from "@/features/site/sample"
import { BOX, ring } from "./printProfiles"

type Text = "title" | "author" | "intro"
type Theme = SiteTexts["theme"]
const ROW = "flex min-h-13 items-center gap-4 px-4 py-2"
const TOP = "items-start py-3"
const LABEL = "w-[160px] shrink-0 text-sm"
const INPUT = "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
/** the kit Field ring for the textarea (`ring()` keys on an input) */
const AREA_RING = "has-[textarea:focus-visible]:shadow-none has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-inset has-[textarea:focus-visible]:ring-[#535152]"
export const INTRO_MAX = 160
/** S4: from 150 characters the counter turns ink 500 */
const NEAR = 150
/** S2: values are trimmed and inner whitespace collapsed on commit */
const clean = (s: string) => s.replace(/\s+/g, " ").trim()
/** S4: line breaks are not kept, a pasted newline becomes a space */
const oneLine = (s: string) => s.replace(/\r\n?|\n/g, " ")

/** a text field's draft: commit on blur / Enter (only when the clean value differs), Esc reverts and keeps focus */
function useDraft(stored: string, commit: (v: string) => void) {
  const [v, setV] = React.useState(stored)
  React.useEffect(() => setV(stored), [stored])
  const done = () => { const c = clean(v); setV(c); if (c !== stored) commit(c) }
  return {
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(oneLine(e.target.value)),
    onBlur: done,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); done() }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setV(stored) }
    },
  }
}

const HINT = "mt-1 flex gap-3 text-xs leading-[16.8px] text-muted-foreground"
function Field({ f, label, hint, placeholder, stored, commit }: { f: Exclude<Text, "intro">; label: string; hint: string; placeholder: string; stored: string; commit: (v: string) => void }) {
  const d = useDraft(stored, commit)
  const id = `site-${f}`
  return (
    <div className={ROW} data-testid={`site-${f}-row`}>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="min-w-0 flex-1">
        <div className={cn(BOX, ring(false))}>
          <input id={id} data-testid={id} maxLength={80} autoComplete="off" spellCheck={false} placeholder={placeholder} aria-describedby={`${id}-hint`} className={INPUT} {...d} />
        </div>
        <div className={HINT}><span id={`${id}-hint`} className="flex-1">{hint}</span></div>
      </div>
    </div>
  )
}

function Intro({ stored, placeholder, commit }: { stored: string; placeholder: string; commit: (v: string) => void }) {
  const d = useDraft(stored, commit)
  const n = d.value.length
  return (
    <div className={cn(ROW, TOP)} data-testid="site-intro-row">
      <label htmlFor="site-intro" className={cn(LABEL, "pt-1.5")}>Intro</label>
      <div className="min-w-0 flex-1">
        <div className={cn(BOX, "h-auto min-h-[70.5px] items-start py-1.5", AREA_RING)}>
          <textarea id="site-intro" data-testid="site-intro" rows={3} maxLength={INTRO_MAX} autoComplete="off" spellCheck placeholder={placeholder} aria-describedby="site-intro-hint site-intro-count" className={cn(INPUT, "block resize-none leading-[19.5px]")} {...d} />
        </div>
        <div className={HINT}>
          <span id="site-intro-hint" className="flex-1">The first lines of your home page.</span>
          <span id="site-intro-count" data-testid="site-intro-count" className="shrink-0 tabular-nums" style={n >= NEAR ? { color: "#393738", fontWeight: 500 } : undefined}>{n} / {INTRO_MAX}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- theme tiles */
/** the site's `--bg` / `--ink` per theme (features/site/system.css) */
const LOOK: Record<Theme, { bg: string; ink: string }> = { light: { bg: "#f4f3f0", ink: "#141414" }, dark: { bg: "#111110", ink: "#eceae6" } }
/** spines at bay left 46 / 51 / 56 / 61 */
const SPINES = [[46, 17, "#CBD5DA"], [51, 18, "#D9C6A3"], [56, 18, "#1E4B57"], [61, 21, "#2D4A2B"]] as const
const at = (left: number, top: number, width: number, height: number): React.CSSProperties => ({ position: "absolute", left, top, width, height })
/** the home in miniature (static markup): name, two lead lines and the case with a face-out cover and four spines */
function Miniature({ t }: { t: Theme }) {
  const { bg, ink } = LOOK[t]
  return (
    <div className="relative size-full" style={{ background: bg }} aria-hidden data-testid={`site-theme-mini-${t}`}>
      <div style={{ ...at(6, 5, 22, 3), background: ink }} />
      <div style={{ ...at(14, 14, 58, 4), background: ink, opacity: 0.85 }} />
      <div style={{ ...at(14, 21, 30, 4), background: ink, opacity: 0.85 }} />
      <div style={{ ...at(14, 31, 92, 37), background: "#E4DDD1" }}>
        <div style={{ ...at(5, 3, 84, 31), background: "#CEC6B6" }}>
          <div style={{ position: "absolute", left: 24, bottom: 0, width: 19, height: 23, background: "linear-gradient(#7c9fc4, #2f7f8c 60%, #3d5a3a)" }} />
          {SPINES.map(([x, h, c]) => <div key={x} style={{ position: "absolute", left: x, bottom: 0, width: 4, height: h, background: c }} />)}
        </div>
      </div>
    </div>
  )
}

const THEMES: [Theme, string][] = [["light", "Light"], ["dark", "Dark"]]
function ThemeTiles({ value, onPick }: { value: Theme; onPick: (t: Theme) => void }) {
  const refs = React.useRef<Partial<Record<Theme, HTMLButtonElement | null>>>({})
  const key = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = THEMES.findIndex(([t]) => t === value)
    const next = THEMES[(i + step + THEMES.length) % THEMES.length][0]
    onPick(next); refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-3" data-testid="site-theme" onKeyDown={key}>
      {THEMES.map(([t, l]) => {
        const on = t === value
        return (
          <button key={t} ref={(el) => { refs.current[t] = el }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-testid={`site-theme-${t}`}
            onClick={() => onPick(t)} className="group/tile flex w-[120px] flex-col items-center gap-1.5 pb-0 outline-none">
            <span className={cn("block h-[75px] w-[120px] overflow-hidden rounded-lg transition-[box-shadow,translate] duration-[120ms] ease-in-out",
              "group-focus-visible/tile:outline-2 group-focus-visible/tile:outline-offset-3 group-focus-visible/tile:outline-[#3A3839]",
              on ? "shadow-tile-select" : "shadow-tile-rest group-hover/tile:-translate-y-px group-hover/tile:shadow-tile-hover motion-reduce:group-hover/tile:translate-y-0")}
              data-testid={`site-theme-tile-${t}`}><Miniature t={t} /></span>
            <span className={cn("text-sm leading-[19.5px]", on && "font-medium")}>{l}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- the card */
/** S3: the fallbacks are the placeholders, so an empty field shows what the site will show */
const introPlaceholder = (author: string) => (author ? `Photobooks by ${author}.` : "A line or two about your books")
export function SiteSection({ rule, site, onSite }: { rule: React.ReactNode; site: SiteTexts; onSite: (s: SiteTexts) => void }) {
  const put = (k: Text) => (v: string) => onSite({ ...site, [k]: v })
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">How your site introduces you. Changes go live the next time you publish.</p>
      <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="site-settings">
        <Field f="title" label="Site title" hint="In the browser tab and in link previews." placeholder="Photobooks" stored={site.title} commit={put("title")} />
        {rule}
        <Field f="author" label="Author" hint="Your name, at the top of every page." placeholder="Your name" stored={site.author} commit={put("author")} />
        {rule}
        <Intro stored={site.intro} placeholder={introPlaceholder(site.author)} commit={put("intro")} />
        {rule}
        <div className={cn(ROW, TOP)} data-testid="site-theme-row">
          <div className={cn(LABEL, "pt-1.5")} aria-hidden>Theme</div>
          <ThemeTiles value={site.theme} onPick={(theme) => { if (theme !== site.theme) onSite({ ...site, theme }) }} />
        </div>
      </div>
    </>
  )
}

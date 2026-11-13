/* Settings → Site (Designer spec site-settings § Spec): Site title, Author and Intro, edited in place and saved on commit
   (S2: blur / Enter; Esc reverts and keeps focus). Field rows are the Hosting field row in Inter 13. The site has one
   look (Owner 2026-11-13: no Theme). */
import * as React from "react"
import { cn } from "@/lib/utils"
import type { SiteTexts } from "@/features/site/sample"
import { BOX, ring } from "./printProfiles"

type Text = "title" | "author" | "intro"
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
      </div>
    </>
  )
}

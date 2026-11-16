import {
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { SiteSettings } from '../project/types'
import { cn } from '../ui/cn'
import {
  getSiteSettings,
  setSiteSettings,
  subscribeSiteSettings,
} from './siteSettingsStore'

/*
 * Settings → Site (Designer spec site-settings § Spec, kit
 * `demo-parts/siteSettings.tsx`): Site title, Author and Intro, edited in
 * place and saved on commit (S2). The field row is the Hosting field row in
 * Inter 13. The site has one look (Owner 2026-11-13: no Theme).
 */

type Text = keyof SiteSettings

/* BOX / ring: the Hosting field (private there). */
const BOX =
  'flex h-8 items-center rounded-md bg-field px-2.5 text-sm text-foreground'
/** Focus-visible: no shadow, a 1 px inset `#535152` ring. */
const FOCUS =
  'has-[:focus-visible]:shadow-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-[#535152]'
/** Inputs rest on `shadow-xs`; the kit Intro box has none. */
const RING = `shadow-xs ${FOCUS}`
const TOP = 'items-start py-3'
const LABEL = 'w-[160px] shrink-0 text-sm'
const INPUT =
  'min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground'
const HINT = 'mt-1 flex gap-3 text-xs leading-[16.8px] text-muted-foreground'
const TEXT_MAX = 80
const INTRO_MAX = 160
/** S4: from 150 characters the counter turns ink 500. */
const NEAR = 150
/** S2: values are trimmed and inner whitespace collapsed on commit. */
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
/** S4: line breaks are not kept, a pasted newline becomes a space. */
const oneLine = (s: string) => s.replace(/\r\n?|\n/g, ' ')

/**
 * A field's draft: typing re-renders this field only. Blur / Enter commit
 * the clean value when it differs from the stored one; Esc reverts and keeps
 * focus.
 */
function useDraft(stored: string, commit: (v: string) => void) {
  const [value, setValue] = useState(stored)
  const [seen, setSeen] = useState(stored)
  if (seen !== stored) {
    setSeen(stored)
    setValue(stored)
  }
  const done = () => {
    const next = clean(value)
    setValue(next)
    if (next !== stored) commit(next)
  }
  return {
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(oneLine(event.target.value))
    },
    onBlur: done,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        done()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setValue(stored)
      }
    },
  }
}

function Field({
  row,
  field,
  label,
  hint,
  placeholder,
  stored,
  commit,
}: {
  row: string
  field: 'title' | 'author'
  label: string
  hint: string
  placeholder: string
  stored: string
  commit: (v: string) => void
}) {
  const draft = useDraft(stored, commit)
  const id = `site-${field}`
  return (
    <div className={row} data-testid={`${id}-row`}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="min-w-0 flex-1">
        <div className={cn(BOX, RING)}>
          <input
            id={id}
            data-testid={id}
            maxLength={TEXT_MAX}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            aria-describedby={`${id}-hint`}
            className={INPUT}
            {...draft}
          />
        </div>
        <div className={HINT}>
          <span id={`${id}-hint`} className="flex-1">
            {hint}
          </span>
        </div>
      </div>
    </div>
  )
}

function Intro({
  row,
  stored,
  placeholder,
  commit,
}: {
  row: string
  stored: string
  placeholder: string
  commit: (v: string) => void
}) {
  const draft = useDraft(stored, commit)
  const n = draft.value.length
  return (
    <div className={cn(row, TOP)} data-testid="site-intro-row">
      <label htmlFor="site-intro" className={cn(LABEL, 'pt-1.5')}>
        Intro
      </label>
      <div className="min-w-0 flex-1">
        <div
          className={cn(BOX, 'h-auto min-h-[70.5px] items-start py-1.5', FOCUS)}
        >
          <textarea
            id="site-intro"
            data-testid="site-intro"
            rows={3}
            maxLength={INTRO_MAX}
            autoComplete="off"
            spellCheck
            placeholder={placeholder}
            aria-describedby="site-intro-hint site-intro-count"
            className={cn(INPUT, 'block resize-none leading-[19.5px]')}
            {...draft}
          />
        </div>
        <div className={HINT}>
          <span id="site-intro-hint" className="flex-1">
            The first lines of your home page.
          </span>
          <span
            id="site-intro-count"
            data-testid="site-intro-count"
            className="shrink-0 tabular-nums"
            style={
              n >= NEAR ? { color: '#393738', fontWeight: 500 } : undefined
            }
          >
            {n} / {INTRO_MAX}
          </span>
        </div>
      </div>
    </div>
  )
}

/** S3: the fallbacks are the placeholders, so an empty field shows what the site will show. */
function introPlaceholder(author: string): string {
  return author === ''
    ? 'A line or two about your books'
    : `Photobooks by ${author}.`
}

const put = (key: Text) => (value: string) => {
  setSiteSettings({ [key]: value })
}

export function SiteSettingsSection({
  row,
  rule,
}: {
  row: string
  rule: () => ReactNode
}) {
  const site = useSyncExternalStore(
    subscribeSiteSettings,
    getSiteSettings,
    getSiteSettings,
  )
  const author = site.author ?? ''
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
        How your site introduces you. Changes go live the next time you publish.
      </p>
      <div
        className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome"
        data-testid="site-settings"
      >
        <Field
          row={row}
          field="title"
          label="Site title"
          hint="In the browser tab and in link previews."
          placeholder="Photobooks"
          stored={site.title ?? ''}
          commit={put('title')}
        />
        {rule()}
        <Field
          row={row}
          field="author"
          label="Author"
          hint="Your name, at the top of every page."
          placeholder="Your name"
          stored={author}
          commit={put('author')}
        />
        {rule()}
        <Intro
          row={row}
          stored={site.intro ?? ''}
          placeholder={introPlaceholder(author)}
          commit={put('intro')}
        />
      </div>
    </>
  )
}

import { useState, useSyncExternalStore } from 'react'
import {
  bookPrintProfile,
  findPrintProfile,
  PAGE_NUMBER_START_MAX,
  PAGE_NUMBER_START_MIN,
  pageCountRange,
  pageNumberingOf,
  printIssues,
  printIssueText,
  profileHint,
  TRIM_MAX_MM,
  TRIM_MIN_MM,
  type Book,
  type PageCountRange,
} from '../core'
import { Icon } from '../ui/Icon'
import { bookPageNumbersNote, PAGE_NUMBER_FORMATS } from './inspectorModel'
import { printProfileOptions } from './printProfileDraft'
import { getPrintProfiles, subscribePrintProfiles } from './printProfilesStore'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  bookSettingsSubtitle,
  FIELD,
  fmtN,
  pagesNote,
  pagesOf,
  SUB,
  T,
} from './editorChromeTokens'
import { Select } from '../ui/Select'
import {
  InspectorHead,
  InspectorRow,
  InspectorSec,
  ReadOnlyPill,
  ToggleSwitch,
} from './InspectorControls'

type Unit = 'cm' | 'mm'

/** Kit PRINT warning text (`text-[#8a5a12]`); the prod status tokens are grey. */
const WARNING_TEXT = '#8a5a12'

/** Kit v7.tsx `mm`: profile values as is, up to 3 decimals (3.175, 12.7). */
function exactMm(n: number): string {
  return String(Number(n.toFixed(3)))
}

/** Kit PRESETS (uikit/src/sandbox/v7.tsx:55-57), cm. */
const PRESETS: readonly { id: string; name: string; w: number; h: number }[] = [
  { id: 'A6', name: 'A6', w: 10.5, h: 14.8 },
  { id: 'A5', name: 'A5', w: 14.8, h: 21 },
  { id: 'A4', name: 'A4', w: 21, h: 29.7 },
  { id: 'A3', name: 'A3', w: 29.7, h: 42 },
  { id: 'Letter', name: 'Letter', w: 21.6, h: 27.9 },
  { id: 'sq20', name: 'Square 20×20', w: 20, h: 20 },
  { id: 'sq30', name: 'Square 30×30', w: 30, h: 30 },
]
const CUSTOM = 'custom'

/** Kit presetLabel (v7.tsx:58): name · short × long cm, swapped when landscape. */
function presetLabel(
  preset: (typeof PRESETS)[number],
  landscape: boolean,
): string {
  const swap = landscape && preset.w !== preset.h
  return `${preset.name} · ${fmtN(swap ? preset.h : preset.w)} × ${fmtN(swap ? preset.w : preset.h)} cm`
}

function presetFor(trim: { widthMm: number; heightMm: number }): string {
  const found = PRESETS.find((p) => {
    const w = Math.round(p.w * 10)
    const h = Math.round(p.h * 10)
    return (
      (Math.round(trim.widthMm) === w && Math.round(trim.heightMm) === h) ||
      (Math.round(trim.widthMm) === h && Math.round(trim.heightMm) === w)
    )
  })
  return found?.id ?? CUSTOM
}

/** Kit `Field` (v7.tsx:132) without a setter: label, mono value, unit. */
function ReadOnlyField({
  label,
  value,
  unit,
  testId,
}: {
  label: string
  value: string
  unit: string
  testId: string
}) {
  return (
    <div className="insp-size-field" data-testid={testId}>
      <span className="text-center text-muted-foreground">{label}</span>
      <span className="flex-1 font-mono tabular-nums">{value}</span>
      <span className="text-muted-foreground">{unit}</span>
    </div>
  )
}

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit SizeEditor number field (uikit/src/sandbox/v7.tsx:162-166). */
function SizeField({
  axis,
  label,
  unit,
  mm,
}: {
  axis: 'widthMm' | 'heightMm'
  label: 'W' | 'H'
  unit: Unit
  mm: number
}) {
  const k = unit === 'mm' ? 1 : 0.1
  const shown = Math.round(mm * k * 10) / 10
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const value = Number.parseFloat(text) / k
    if (value >= TRIM_MIN_MM && value <= TRIM_MAX_MM) {
      const { trim } = readBook().settings
      dispatchBookOp({
        type: 'setTrim',
        widthMm: axis === 'widthMm' ? value : trim.widthMm,
        heightMm: axis === 'heightMm' ? value : trim.heightMm,
      })
    }
  }
  return (
    <label className="insp-size-field">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        className="font-mono"
        aria-label={`${axis === 'widthMm' ? 'Width' : 'Height'} (${unit})`}
        data-testid={axis === 'widthMm' ? 'size-w' : 'size-h'}
        step={unit === 'mm' ? 1 : 0.1}
        min={TRIM_MIN_MM * k}
        max={TRIM_MAX_MM * k}
        value={draft ?? shown}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          commit(event.currentTarget.value)
        }}
        onBlur={() => {
          setDraft(null)
        }}
      />
      <span className="text-muted-foreground">{unit}</span>
    </label>
  )
}

/**
 * Rendered #/demo step 24: compact filled number box (kit `Val` metrics, no
 * spin arrows). A typed count commits on Enter / blur, clamped to 20–120 in
 * steps of 2, and adds or removes spreads at the end (one undo step).
 */
function PagesField({
  pages,
  range,
}: {
  pages: number
  range: PageCountRange
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(pages)
  const commit = () => {
    // No draft ("null") or a non-number parses to NaN: the book is kept.
    dispatchBookOp({
      type: 'setPageCount',
      pages: Number.parseFloat(String(draft)),
    })
    setDraft(null)
  }
  return (
    <input
      type="number"
      className="insp-pages-field rounded-sm px-2 py-1 text-sm"
      aria-label="Pages"
      data-testid="book-pages-input"
      min={range.min}
      max={range.max}
      step={range.step}
      value={shown}
      style={{
        width: `calc(${String(Math.max(2, shown.length))}ch + 1rem)`,
        background: FIELD,
        color: T,
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        } else if (event.key === 'Escape') {
          setDraft(null)
        }
      }}
      onBlur={commit}
    />
  )
}

/**
 * Designer page-numbers Start at: the Pages box look; Enter / blur commit
 * (the op rounds, clamps to 1–999 and keeps the book on NaN), Esc reverts.
 */
function StartAtField({ start }: { start: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(start)
  const commit = () => {
    dispatchBookOp({
      type: 'setPageNumbering',
      patch: { start: Number.parseFloat(String(draft)) },
    })
    setDraft(null)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      className="insp-pages-field rounded-sm px-2 py-1 text-center text-sm"
      aria-label="Start page numbers at"
      data-testid="book-pn-start"
      min={PAGE_NUMBER_START_MIN}
      max={PAGE_NUMBER_START_MAX}
      step={1}
      value={shown}
      style={{
        width: `calc(${String(Math.max(2, shown.length))}ch + 1rem)`,
        background: FIELD,
        color: T,
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        } else if (event.key === 'Escape') {
          setDraft(null)
        }
      }}
      onBlur={commit}
    />
  )
}

/** Designer page-numbers: how the book counts (masters say whether / where). */
function BookPageNumbers({ book }: { book: Book }) {
  const { start, skipFirst, format } = pageNumberingOf(book)
  return (
    <InspectorSec title="Page numbers" testId="book-page-numbers">
      <InspectorRow label="Start at">
        <StartAtField start={start} />
      </InspectorRow>
      <div className="mt-3" data-testid="book-pn-format">
        <SegmentedControl
          label="Page number format"
          size="inspector"
          items={PAGE_NUMBER_FORMATS}
          value={format}
          onChange={(next) => {
            dispatchBookOp({
              type: 'setPageNumbering',
              patch: { format: next },
            })
          }}
        />
      </div>
      <InspectorRow label="Skip first page">
        <ToggleSwitch
          label="Skip first page"
          testId="book-pn-skip-first"
          on={skipFirst}
          onChange={(next) => {
            dispatchBookOp({
              type: 'setPageNumbering',
              patch: { skipFirst: next },
            })
          }}
        />
      </InspectorRow>
      <div
        className="mt-1.5 text-2xs leading-[1.35]"
        style={{ color: SUB }}
        data-testid="book-pn-note"
      >
        {bookPageNumbersNote(book)}
      </div>
    </InspectorSec>
  )
}

/** Kit "Book settings" (uikit/src/sandbox/v7.tsx:200-210) on the document. */
export function BookSettingsSection() {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { settings, spreads, cover, parents, defaultParentId } = book
  const defaultParent = parents?.find((parent) => parent.id === defaultParentId)
  const pages = pagesOf(spreads.length)
  const [unit, setUnit] = useState<Unit>('cm')
  const [customPicked, setCustomPicked] = useState(false)
  const [said, setSaid] = useState('')
  const customs = useSyncExternalStore(
    subscribePrintProfiles,
    getPrintProfiles,
    getPrintProfiles,
  )
  const profile = bookPrintProfile(book, customs)
  const range = pageCountRange(profile)
  const { trim, endpapers } = settings
  const landscape = trim.widthMm > trim.heightMm
  const matched = presetFor(trim)
  const presetValue = customPicked ? CUSTOM : matched
  // Kit Book settings part (v7.tsx:202-210): Head plus Sec / Row blocks, the
  // Endpaper rhythm (Owner Must M59, round 10).
  return (
    <section data-testid="book-settings" aria-label="Book settings">
      <InspectorHead
        title="Book settings"
        sub={bookSettingsSubtitle(cover.back.text, cover.front.text)}
        subTestId="book-settings-subtitle"
      />
      <InspectorSec title="Page size">
        {/* Kit SizeEditor select (v7.tsx:172-174), presets plus "Custom". */}
        <Select
          aria-label="Page size"
          data-testid="size-preset"
          className="insp-size-select"
          value={presetValue}
          options={[
            ...PRESETS.map((p) => ({
              value: p.id,
              label: presetLabel(p, landscape),
            })),
            { value: CUSTOM, label: 'Custom' },
          ]}
          onChange={(value) => {
            const preset = PRESETS.find((p) => p.id === value)
            setCustomPicked(preset === undefined)
            if (preset !== undefined) {
              const swap = landscape && preset.w !== preset.h
              dispatchBookOp({
                type: 'setTrim',
                widthMm: Math.round((swap ? preset.h : preset.w) * 10),
                heightMm: Math.round((swap ? preset.w : preset.h) * 10),
              })
            }
          }}
        />
        <div className="mt-3" data-testid="size-orientation">
          <SegmentedControl
            label="Orientation"
            size="inspector"
            items={[
              { id: 'portrait', label: 'Portrait' },
              { id: 'landscape', label: 'Landscape' },
            ]}
            value={landscape ? 'landscape' : 'portrait'}
            onChange={(value) => {
              if ((value === 'landscape') !== landscape) {
                dispatchBookOp({
                  type: 'setTrim',
                  widthMm: trim.heightMm,
                  heightMm: trim.widthMm,
                })
              }
            }}
          />
        </div>
        {presetValue === CUSTOM ? (
          <div className="mt-3" data-testid="size-unit">
            <SegmentedControl
              label="Units"
              size="inspector"
              items={[
                { id: 'cm', label: 'cm' },
                { id: 'mm', label: 'mm' },
              ]}
              value={unit}
              onChange={(value) => {
                setUnit(value === 'mm' ? 'mm' : 'cm')
              }}
            />
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SizeField axis="widthMm" label="W" unit={unit} mm={trim.widthMm} />
          <SizeField axis="heightMm" label="H" unit={unit} mm={trim.heightMm} />
        </div>
        <div className="mt-1.5 text-2xs leading-4 text-muted-foreground">
          Size of one page. To print 2 pages per A4 sheet, choose A5.
        </div>
      </InspectorSec>
      <InspectorSec title="Binding">
        <InspectorRow label="Style">
          {/* Kit v7.tsx:205: disabled Val pill + "read-only" note. */}
          <ReadOnlyPill
            value="Hardcover"
            note="read-only"
            testId="binding-style"
            noteTestId="binding-readonly"
          />
        </InspectorRow>
        <InspectorRow label="Endpapers">
          <ToggleSwitch
            label="Endpapers"
            testId="book-endpapers"
            on={endpapers.enabled}
            onChange={(enabled) => {
              dispatchBookOp({ type: 'setEndpapersEnabled', enabled })
            }}
          />
        </InspectorRow>
        {/* Rendered #/demo step 24: pages box, range hint and the spreads note. */}
        <InspectorRow label="Pages">
          <span className="flex items-center gap-1" data-testid="book-pages">
            <PagesField pages={pages} range={range} />
            <span
              className="text-2xs"
              style={{ color: SUB }}
              data-testid="book-pages-range"
            >
              {range.min}–{range.max}
            </span>
          </span>
        </InspectorRow>
        <div
          className="mt-1.5 text-2xs text-muted-foreground"
          data-testid="book-pages-note"
        >
          {pagesNote(pages, range)}
        </div>
      </InspectorSec>
      <BookPageNumbers book={book} />
      <InspectorSec title="Print">
        {/* Kit v7.tsx:305-313: Printer select, hint, warnings, then B / S
            (bleed / safe from the profile, D4) and the paper pill. */}
        <Select
          aria-label="Printer"
          data-testid="book-print-profile"
          className="insp-size-select"
          value={profile.id}
          options={printProfileOptions(customs, book.printProfile?.snapshot)}
          onChange={(id) => {
            dispatchBookOp({ type: 'setPrintProfile', id, customs })
            const picked = findPrintProfile(id, customs) ?? profile
            setSaid(`Printer: ${picked.name}`)
          }}
        />
        <span className="sr-only" aria-live="polite">
          {said}
        </span>
        <div
          className="mt-1.5 text-2xs leading-4 text-muted-foreground"
          data-testid="book-print-hint"
        >
          {profileHint(profile)}
        </div>
        {printIssues(book, customs).map((issue) => {
          const text = printIssueText(issue, profile.name)
          return (
            <div
              key={text}
              className="mt-2 flex gap-1.5 text-xs leading-[16.8px]"
              style={{ color: WARNING_TEXT }}
              data-testid="book-print-issue"
            >
              <span className="shrink-0" style={{ marginTop: 2.4 }}>
                <Icon name="warning" size={14} className="block size-3" />
              </span>
              {text}
            </div>
          )
        })}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ReadOnlyField
            label="B"
            value={exactMm(settings.bleedMm)}
            unit="mm"
            testId="book-bleed"
          />
          <ReadOnlyField
            label="S"
            value={exactMm(settings.safeMarginMm)}
            unit="mm"
            testId="book-safe-margin"
          />
        </div>
        <InspectorRow label="Paper">
          <ReadOnlyPill value="Matte 200 g" />
        </InspectorRow>
      </InspectorSec>
      <InspectorSec title="Defaults">
        {/* Kit v7.tsx:201,210: default master and page colour (coming later). */}
        <InspectorRow label="Default master" testId="default-master">
          <ReadOnlyPill value={defaultParent?.name ?? 'None'} />
        </InspectorRow>
        <InspectorRow label="Page colour">
          <span
            className="text-sm text-muted-foreground"
            data-testid="page-colour-readonly"
          >
            Paper white · coming later
          </span>
        </InspectorRow>
      </InspectorSec>
    </section>
  )
}

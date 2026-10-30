import { memo, useMemo, useState, useSyncExternalStore } from 'react'
import { Input, NumberField } from 'react-aria-components'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  TEMPLATE_IDS,
  contactSheetId,
  generateTemplateFrames,
  getSpreadSizeMm,
  parseContactSheetId,
  type Book,
  type Frame,
  type Spread,
} from '../core'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { LAYOUT_CHIPS, matchesChip, type LayoutChipId } from './layoutChips'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import './LayoutSection.css'

type FixedTemplateId = (typeof TEMPLATE_IDS)[number]

const TEMPLATE_NAMES: Record<FixedTemplateId, string> = {
  'full-bleed': 'Full bleed',
  'one-per-page': 'One per page',
  '2-up': '2-up',
  '4-grid': '4-grid',
  'two-portraits': '2 portraits',
  'landscape-two-portraits': 'Landscape + 2 portraits',
}

function readBook() {
  return getBookStoreSnapshot().book
}

function templateName(templateId: string | undefined): string | null {
  if (templateId === undefined) {
    return null
  }
  const contact = parseContactSheetId(templateId)
  if (contact !== null) {
    return `Contact sheet ${String(contact.cols)}×${String(contact.rows)}`
  }
  const fixed = TEMPLATE_IDS.find((id) => id === templateId)
  return fixed === undefined ? null : TEMPLATE_NAMES[fixed]
}

const TemplateThumb = memo(function TemplateThumb({
  widthMm,
  heightMm,
  frames,
}: {
  widthMm: number
  heightMm: number
  frames: readonly Frame[]
}) {
  return (
    <svg
      className="layout-thumb"
      viewBox={`0 0 ${String(widthMm)} ${String(heightMm)}`}
      aria-hidden="true"
    >
      {frames.map((frame) => (
        <rect
          key={frame.id}
          x={frame.rect.x}
          y={frame.rect.y}
          width={frame.rect.width}
          height={frame.rect.height}
        />
      ))}
    </svg>
  )
})

function CountField({
  label,
  max,
  value,
  onChange,
  testId,
}: {
  label: string
  max: number
  value: number
  onChange: (value: number) => void
  testId: string
}) {
  return (
    <NumberField
      aria-label={label}
      value={value}
      minValue={1}
      maxValue={max}
      step={1}
      onChange={(next) => {
        if (!Number.isNaN(next)) {
          onChange(next)
        }
      }}
      className="layout-count"
    >
      <Input className="layout-count-input" data-testid={testId} />
    </NumberField>
  )
}

/** Kit LayoutSection: template tiles (fixed catalog) + contact sheet. */
export function LayoutSection({ spreadId }: { spreadId: string }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const spreadIndex = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[spreadIndex]
  if (spread === undefined) {
    return null
  }
  return (
    <LayoutPicker
      spreadId={spreadId}
      book={book}
      spread={spread}
      spreadIndex={spreadIndex}
    />
  )
}

function LayoutPicker({
  spreadId,
  book,
  spread,
  spreadIndex,
}: {
  spreadId: string
  book: Book
  spread: Spread
  spreadIndex: number
}) {
  const current = spread.templateId
  const contact = current === undefined ? null : parseContactSheetId(current)
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(2)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [chip, setChip] = useState<LayoutChipId>('all')
  const [query, setQuery] = useState('')
  // A contact-sheet spread shows its own grid in the fields.
  const contactKey = contact === null ? '' : `${spreadId}/${current ?? ''}`
  const [syncedKey, setSyncedKey] = useState('')
  if (contactKey !== syncedKey) {
    setSyncedKey(contactKey)
    if (contact !== null) {
      setCols(contact.cols)
      setRows(contact.rows)
    }
  }
  // Template geometry depends only on grid, trim and spread count: a drop or
  // crop commit must not regenerate every thumbnail (frame-budget gate).
  const spreadGrid = spread.layoutGrid
  const geometry = useMemo(() => {
    const size = getSpreadSizeMm(book, spreadIndex)
    const frames = {} as Record<FixedTemplateId, readonly Frame[]>
    for (const id of TEMPLATE_IDS) {
      frames[id] = generateTemplateFrames(id, book, spreadIndex, spread)
    }
    return { widthMm: size.widthMm, heightMm: size.heightMm, frames }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [
    book.layoutGrid,
    book.settings,
    book.spreads.length,
    spreadIndex,
    spreadGrid,
  ])
  const summary = templateName(current)
  const slotCount = (id: FixedTemplateId) => geometry.frames[id].length
  // Kit: filled photo frames, else every frame of the spread.
  const filled = spread.frames.filter((f) => f.assetId !== undefined).length
  const photos = filled > 0 ? filled : spread.frames.length
  const wanted = query.trim().toLowerCase()
  // "My templates" has no saved templates yet: the tab lists nothing.
  const list =
    tab === 'mine'
      ? []
      : TEMPLATE_IDS.filter(
          (id) =>
            matchesChip(slotCount(id), chip) &&
            TEMPLATE_NAMES[id].toLowerCase().includes(wanted),
        )
  const suggested =
    tab === 'all' && chip === 'all' && wanted === ''
      ? TEMPLATE_IDS.filter((id) => slotCount(id) === photos && id !== current)
      : []
  const tile = (id: FixedTemplateId, testId: string) => (
    <button
      key={id}
      type="button"
      className="layout-tile"
      data-testid={testId}
      data-template={id}
      aria-pressed={current === id}
      aria-label={`${testId === 'layout-tile' ? 'Apply layout' : 'Apply suggested layout'} ${TEMPLATE_NAMES[id]}`}
      onClick={() => {
        applyMarkedSpreadTemplate(spreadId, id)
      }}
    >
      <TemplateThumb
        widthMm={geometry.widthMm}
        heightMm={geometry.heightMm}
        frames={geometry.frames[id]}
      />
      <span className="layout-tile-name">{TEMPLATE_NAMES[id]}</span>
    </button>
  )
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="layout-section"
      aria-label="Layout"
    >
      <header className="flex items-center gap-2">
        <h4 className="inspector-eyebrow">Layout</h4>
        {summary === null ? null : (
          <span
            className="layout-muted truncate text-xs"
            data-testid="layout-summary"
          >
            {summary}
          </span>
        )}
      </header>
      {/* Kit tabs / search / chips: uikit/src/sandbox/context-inspector.tsx:163-175.
          Toggle buttons, not role=tablist: the inspector itself has no tabs. */}
      <div
        className="layout-tabs"
        role="group"
        aria-label="Template source"
        data-testid="layout-tabs"
      >
        <button
          type="button"
          aria-pressed={tab === 'all'}
          data-testid="tab-all"
          onClick={() => {
            setTab('all')
          }}
        >
          All <span className="layout-muted">{TEMPLATE_IDS.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={tab === 'mine'}
          data-testid="tab-mine"
          onClick={() => {
            setTab('mine')
          }}
        >
          My templates <span className="layout-muted">0</span>
        </button>
      </div>
      <label className="layout-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          aria-label="Search layouts"
          placeholder="Search layouts"
          data-testid="layout-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
      </label>
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Photos per layout"
        data-testid="tpl-chips"
      >
        <span className="layout-muted mr-1 text-xs">Photos</span>
        {LAYOUT_CHIPS.map(([id, text]) => (
          <button
            key={id}
            type="button"
            className="layout-chip"
            aria-pressed={chip === id}
            data-chip={id}
            onClick={() => {
              setChip(id)
            }}
          >
            {text}
          </button>
        ))}
      </div>
      {suggested.length > 0 ? (
        <div data-testid="tpl-suggested">
          <div className="mb-1.5 text-xs font-medium">
            Suggested for {photos} photo{photos === 1 ? '' : 's'}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {suggested.map((id) => tile(id, 'layout-suggested-tile'))}
          </div>
        </div>
      ) : null}
      <div>
        {suggested.length > 0 ? (
          <div className="mb-1.5 text-xs font-medium">All layouts</div>
        ) : null}
        {list.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {list.map((id) => tile(id, 'layout-tile'))}
          </div>
        ) : (
          <p
            className="layout-empty text-center text-xs"
            data-testid="tpl-empty"
          >
            {query === '' && chip === 'all'
              ? 'No templates yet.'
              : 'No layouts match.'}
          </p>
        )}
      </div>
      <p className="layout-muted text-xs" data-testid="tpl-hint">
        Click a layout to apply it to the spread. Photos are kept in order.
      </p>
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label="Contact sheet"
      >
        <CountField
          label="Columns"
          max={CONTACT_MAX_COLS}
          value={cols}
          onChange={setCols}
          testId="layout-contact-cols"
        />
        <span className="layout-muted text-xs" aria-hidden="true">
          ×
        </span>
        <CountField
          label="Rows"
          max={CONTACT_MAX_ROWS}
          value={rows}
          onChange={setRows}
          testId="layout-contact-rows"
        />
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          data-testid="layout-contact-apply"
          onPress={() => {
            applyMarkedSpreadTemplate(spreadId, contactSheetId(cols, rows))
          }}
        >
          Contact sheet
        </Button>
      </div>
    </section>
  )
}

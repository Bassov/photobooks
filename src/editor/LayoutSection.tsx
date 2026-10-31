import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Input, NumberField } from 'react-aria-components'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  contactSheetId,
  generateTemplateFrames,
  getSpreadPageCount,
  getSpreadSizeMm,
  parseContactSheetId,
  type Book,
  type FixedTemplateId,
  type RectMm,
  type Spread,
} from '../core'
import { Button } from '../ui/Button'
import { Disclosure } from '../ui/Disclosure'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { LAYOUT_CHIPS, matchesChip, type LayoutChipId } from './layoutChips'
import { LAYOUT_PICKER, TEMPLATE_NAMES, templateName } from './layoutCatalog'
import { percentStyle, thumbPaperBox, thumbSlots } from './layoutThumb'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { setTemplatePreview } from './templatePreview'
import './LayoutSection.css'

/** Kit LayoutSection shows at most three suggestions (context-inspector.tsx:143). */
const MAX_SUGGESTED = 3

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit TemplateThumb (uikit/src/sandbox/chrome.tsx:241): 2:1 paper, slots, spine. */
const TemplateThumb = memo(function TemplateThumb({
  widthMm,
  heightMm,
  rects,
  spine,
}: {
  widthMm: number
  heightMm: number
  rects: readonly RectMm[]
  spine: boolean
}) {
  return (
    <div className="layout-thumb" data-testid="layout-thumb" aria-hidden="true">
      <div
        className="layout-thumb-paper"
        data-testid="layout-thumb-paper"
        style={percentStyle(thumbPaperBox(widthMm, heightMm))}
      >
        {thumbSlots(widthMm, heightMm, rects).map((slot, index) => (
          <div
            key={index}
            className="layout-thumb-slot"
            data-testid="layout-thumb-slot"
            style={percentStyle(slot)}
          />
        ))}
        {spine ? <div className="layout-thumb-spine" /> : null}
      </div>
    </div>
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

/** Kit LayoutSection: template tiles (kit catalog order) + contact sheet. */
export function LayoutSection({ spreadId }: { spreadId: string }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const spreadIndex = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[spreadIndex]
  // Kit ContextInspector drops the canvas preview when the picker goes away.
  useEffect(
    () => () => {
      setTemplatePreview(null)
    },
    [],
  )
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

function photoLabel(count: number): string {
  return `${String(count)} photo${count === 1 ? '' : 's'}`
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
    const rects = {} as Record<FixedTemplateId, readonly RectMm[]>
    for (const id of LAYOUT_PICKER) {
      rects[id] = generateTemplateFrames(id, book, spreadIndex, spread).map(
        (frame) => frame.rect,
      )
    }
    return {
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      spine: getSpreadPageCount(spreadIndex, book.spreads.length) === 2,
      rects,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [
    book.layoutGrid,
    book.settings,
    book.spreads.length,
    spreadIndex,
    spreadGrid,
  ])
  const summary = templateName(current) ?? undefined
  const slotCount = (id: FixedTemplateId) => geometry.rects[id].length
  // Kit: filled photo frames, else every frame of the spread.
  const filled = spread.frames.filter((f) => f.assetId !== undefined).length
  const photos = filled > 0 ? filled : spread.frames.length
  const wanted = query.trim().toLowerCase()
  // "My templates" has no saved templates yet: the tab lists nothing.
  const list =
    tab === 'mine'
      ? []
      : LAYOUT_PICKER.filter(
          (id) =>
            matchesChip(slotCount(id), chip) &&
            TEMPLATE_NAMES[id].toLowerCase().includes(wanted),
        )
  const suggested =
    tab === 'all' && chip === 'all' && wanted === ''
      ? LAYOUT_PICKER.filter(
          (id) => slotCount(id) === photos && id !== current,
        ).slice(0, MAX_SUGGESTED)
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
      title={`${TEMPLATE_NAMES[id]} · ${photoLabel(slotCount(id))} — hover to preview, click to apply`}
      onMouseEnter={() => {
        setTemplatePreview({ spreadId, templateId: id })
      }}
      onMouseLeave={() => {
        setTemplatePreview(null)
      }}
      onFocus={() => {
        setTemplatePreview({ spreadId, templateId: id })
      }}
      onBlur={() => {
        setTemplatePreview(null)
      }}
      onClick={() => {
        setTemplatePreview(null)
        applyMarkedSpreadTemplate(spreadId, id)
      }}
    >
      <TemplateThumb
        widthMm={geometry.widthMm}
        heightMm={geometry.heightMm}
        rects={geometry.rects[id]}
        spine={geometry.spine}
      />
      <span className="layout-tile-name" data-testid="tpl-name">
        {TEMPLATE_NAMES[id]}
      </span>
    </button>
  )
  return (
    <Disclosure
      title="Layout"
      defaultExpanded
      summary={summary}
      data-testid="layout"
      right={
        // Kit "Save as template"; saving custom layouts is not built yet.
        <IconButton
          label="Save as template"
          size="sm"
          isDisabled
          data-testid="tpl-save"
        >
          <Icon name="plus" />
        </IconButton>
      }
    >
      <div
        className="flex flex-col gap-3 px-4 pt-0.5 pb-3"
        data-testid="layout-section"
        role="group"
        aria-label="Layout"
      >
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
            All <span className="layout-muted">{LAYOUT_PICKER.length}</span>
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
          <span className="layout-muted layout-caption mr-1">Photos</span>
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
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Icon name="sparkles" size={14} className="layout-muted" />
              Suggested for {photoLabel(photos)}
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
            <div className="grid grid-cols-2 gap-1.5" data-testid="tpl-grid">
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
        <p className="layout-muted layout-caption" data-testid="tpl-hint">
          Hover a layout to preview it on the spread; click to apply. Photos are
          kept in order.
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
      </div>
    </Disclosure>
  )
}

import { useState, useSyncExternalStore } from 'react'
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
  type TemplateId,
} from '../core'
import { Button } from '../ui/Button'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import './LayoutSection.css'

const TEMPLATE_NAMES: Record<(typeof TEMPLATE_IDS)[number], string> = {
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

function TemplateThumb({
  book,
  spreadIndex,
  templateId,
}: {
  book: Book
  spreadIndex: number
  templateId: TemplateId
}) {
  const { widthMm, heightMm } = getSpreadSizeMm(book, spreadIndex)
  const frames = generateTemplateFrames(
    templateId,
    book,
    spreadIndex,
    book.spreads[spreadIndex],
  )
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
}

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
  const current = book.spreads[spreadIndex]?.templateId
  const contact = current === undefined ? null : parseContactSheetId(current)
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(2)
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
  if (spreadIndex < 0) {
    return null
  }
  const summary = templateName(current)
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
      <div className="grid grid-cols-2 gap-1.5">
        {TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="layout-tile"
            data-testid="layout-tile"
            data-template={id}
            aria-pressed={current === id}
            aria-label={`Apply layout ${TEMPLATE_NAMES[id]}`}
            onClick={() => {
              applyMarkedSpreadTemplate(spreadId, id)
            }}
          >
            <TemplateThumb
              book={book}
              spreadIndex={spreadIndex}
              templateId={id}
            />
            <span className="layout-tile-name">{TEMPLATE_NAMES[id]}</span>
          </button>
        ))}
      </div>
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

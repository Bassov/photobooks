import { memo, useState, useSyncExternalStore } from 'react'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  TEMPLATE_IDS,
  contactSheetId,
  parseContactSheetId,
  type TemplateId,
} from '../core'
import '../ui/Button.css'
import { SegmentedControl } from '../ui/SegmentedControl'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getSpreadTemplateId, subscribeSpread } from './bookStore'

const TEMPLATE_ITEMS: { id: TemplateId; label: string }[] = [
  { id: 'full-bleed', label: 'Full bleed' },
  { id: 'one-per-page', label: 'One per page' },
  { id: '2-up', label: '2-up' },
  { id: '4-grid', label: '4-grid' },
  { id: 'two-portraits', label: '2 portraits' },
  { id: 'landscape-two-portraits', label: 'Landscape + 2 portraits' },
]

function parseCount(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }
  const n = Number(value)
  return n >= 1 && n <= max ? n : null
}

export const SpreadTemplateBar = memo(function SpreadTemplateBar({
  spreadId,
  onAddSpread,
}: {
  spreadId: string | null
  onAddSpread: () => void
}) {
  const readTemplateId = (): string | null =>
    spreadId === null ? null : getSpreadTemplateId(spreadId)
  const templateId = useSyncExternalStore(
    (listener) =>
      spreadId === null ? () => undefined : subscribeSpread(spreadId, listener),
    readTemplateId,
    readTemplateId,
  )
  const [colsText, setColsText] = useState('3')
  const [rowsText, setRowsText] = useState('2')

  const contact = templateId === null ? null : parseContactSheetId(templateId)
  const selected =
    contact !== null
      ? ''
      : templateId !== null && TEMPLATE_IDS.includes(templateId as never)
        ? templateId
        : 'one-per-page'
  const cols = parseCount(colsText, CONTACT_MAX_COLS)
  const rows = parseCount(rowsText, CONTACT_MAX_ROWS)
  const contactKey = contact === null ? '' : (templateId ?? '')
  const [syncedKey, setSyncedKey] = useState('')
  if (contactKey !== syncedKey) {
    setSyncedKey(contactKey)
    if (contact !== null) {
      setColsText(String(contact.cols))
      setRowsText(String(contact.rows))
    }
  }

  return (
    <div className="spread-template-bar">
      <SegmentedControl
        label="Template for this spread"
        size="sm"
        value={selected}
        isDisabled={spreadId === null}
        onChange={(id) => {
          applyMarkedSpreadTemplate(spreadId, id as TemplateId)
        }}
        items={TEMPLATE_ITEMS}
      />
      <div
        className="spread-template-contact"
        role="group"
        aria-label="Contact sheet"
      >
        <input
          type="number"
          className="spread-template-count"
          aria-label="Columns"
          data-testid="contact-cols"
          min={1}
          max={CONTACT_MAX_COLS}
          value={colsText}
          disabled={spreadId === null}
          onChange={(event) => {
            setColsText(event.target.value)
          }}
        />
        <span aria-hidden="true">×</span>
        <input
          type="number"
          className="spread-template-count"
          aria-label="Rows"
          data-testid="contact-rows"
          min={1}
          max={CONTACT_MAX_ROWS}
          value={rowsText}
          disabled={spreadId === null}
          onChange={(event) => {
            setRowsText(event.target.value)
          }}
        />
        <button
          type="button"
          className="pb-button pb-button--secondary pb-button--sm"
          data-testid="contact-apply"
          disabled={spreadId === null || cols === null || rows === null}
          onClick={() => {
            if (cols !== null && rows !== null) {
              applyMarkedSpreadTemplate(spreadId, contactSheetId(cols, rows))
            }
          }}
        >
          Contact sheet
        </button>
      </div>
      <button
        type="button"
        className="pb-button pb-button--secondary pb-button--sm spread-template-add"
        data-testid="template-add-spread"
        onClick={onAddSpread}
        disabled={spreadId === null}
      >
        Add spread
      </button>
    </div>
  )
})

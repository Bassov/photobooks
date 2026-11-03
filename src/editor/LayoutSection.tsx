import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Button as AriaButton, Input, NumberField } from 'react-aria-components'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  contactSheetId,
  customLayoutRects,
  generateTemplateFrames,
  getSpreadPageCount,
  getSpreadSizeMm,
  parseContactSheetId,
  spreadLayoutSlots,
  type Book,
  type FixedTemplateId,
  type RectMm,
  type Spread,
} from '../core'
import { Button } from '../ui/Button'
import { Disclosure } from '../ui/Disclosure'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu'
import { LAYOUT_CHIPS, matchesChip, type LayoutChipId } from './layoutChips'
import {
  LAYOUT_PICKER,
  TEMPLATE_NAMES,
  applyLayout,
  mergeLayouts,
  sortByPhotoCount,
  templateName,
  type LayoutItem,
} from './layoutCatalog'
import {
  percentStyle,
  thumbAspect,
  thumbColumns,
  thumbPaperBox,
  thumbSlots,
} from './layoutThumb'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import {
  addSavedTemplate,
  deleteSavedTemplate,
  duplicateSavedTemplate,
  getSavedTemplates,
  nextTemplateName,
  renameSavedTemplate,
  subscribeSavedTemplates,
} from './savedTemplates'
import { setTemplatePreview } from './templatePreview'
import './LayoutSection.css'

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * Kit TemplateThumb (uikit/src/sandbox/chrome.tsx:241): paper, slots, spine.
 * Owner 2026-11-02: the box takes the clamped trim aspect, not the kit's 2:1.
 */
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
    <div
      className="layout-thumb"
      data-testid="layout-thumb"
      aria-hidden="true"
      style={{ aspectRatio: thumbAspect(widthMm, heightMm) }}
    >
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

/**
 * Kit LayoutSection with the Owner's 2026-11-02 simplification: one list by
 * photo count, uncaptioned builtins, no search / Suggested; + contact sheet.
 */
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
  const mine = useSyncExternalStore(
    subscribeSavedTemplates,
    getSavedTemplates,
    getSavedTemplates,
  )
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(2)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [chip, setChip] = useState<LayoutChipId>('all')
  const [renaming, setRenaming] = useState<string | null>(null)
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
    const { items: builtins, aliases } = mergeLayouts(
      LAYOUT_PICKER.map((id: FixedTemplateId): LayoutItem => ({
        id,
        name: TEMPLATE_NAMES[id],
        rects: generateTemplateFrames(id, book, spreadIndex, spread).map(
          (frame) => frame.rect,
        ),
        saved: false,
      })),
      size,
    )
    return {
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      spine: getSpreadPageCount(spreadIndex, book.spreads.length) === 2,
      builtins,
      aliases,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [
    book.layoutGrid,
    book.settings,
    book.spreads.length,
    spreadIndex,
    spreadGrid,
  ])
  const saved = useMemo(
    () =>
      mine.map((t): LayoutItem => ({
        id: t.id,
        name: t.name,
        rects: customLayoutRects(book, spreadIndex, t.slots),
        saved: true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trim + spread count only
    [mine, book.settings, book.spreads.length, spreadIndex],
  )
  const all = [...geometry.builtins, ...saved]
  // A merged-away builtin (Two portraits on a two-page spread) presses and
  // names the tile that stands for it; the stored id and frames stay as is.
  const selected =
    current === undefined
      ? undefined
      : (geometry.aliases.get(current) ?? current)
  const note = templateName(selected) ?? undefined
  const list = sortByPhotoCount(
    (tab === 'mine' ? saved : all).filter((item) =>
      matchesChip(item.rects.length, chip),
    ),
  )
  // Kit `save`: the spread's photo frames become "My layout N", named inline.
  const save = () => {
    // Only reachable while `canSave`: the spread has at least one image frame.
    const slots = spreadLayoutSlots(readBook(), spreadId)
    const added = addSavedTemplate(nextTemplateName(), slots)
    setTab('mine')
    setChip('all')
    setRenaming(added.id)
  }
  const canSave = spread.frames.some((frame) => frame.kind !== 'text')
  const tile = (item: LayoutItem) => (
    <div key={item.id} className="layout-tile-cell">
      <button
        type="button"
        className="layout-tile"
        data-testid="layout-tile"
        data-template={item.id}
        aria-pressed={selected === item.id}
        aria-label={`Apply layout ${item.name}`}
        // Owner 2026-11-02: builtins carry no caption, the name is the tooltip.
        title={item.name}
        onMouseEnter={() => {
          setTemplatePreview({ spreadId, templateId: item.id })
        }}
        onMouseLeave={() => {
          setTemplatePreview(null)
        }}
        onFocus={() => {
          setTemplatePreview({ spreadId, templateId: item.id })
        }}
        onBlur={() => {
          setTemplatePreview(null)
        }}
        onClick={() => {
          setTemplatePreview(null)
          applyLayout(spreadId, item.id)
        }}
      >
        <TemplateThumb
          widthMm={geometry.widthMm}
          heightMm={geometry.heightMm}
          rects={item.rects}
          spine={geometry.spine}
        />
        {!item.saved || renaming === item.id ? null : (
          <span className="layout-tile-name" data-testid="tpl-name">
            {item.name}
          </span>
        )}
      </button>
      {renaming === item.id ? (
        <input
          // Kit: the new template's name field takes focus right away.
          autoFocus
          className="layout-rename"
          defaultValue={item.name}
          aria-label="Template name"
          data-testid="tpl-rename-input"
          onFocus={(event) => {
            event.currentTarget.select()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              renameSavedTemplate(item.id, event.currentTarget.value)
              setRenaming(null)
            } else if (event.key === 'Escape') {
              event.stopPropagation()
              setRenaming(null)
            }
          }}
          onBlur={(event) => {
            renameSavedTemplate(item.id, event.currentTarget.value)
            setRenaming(null)
          }}
        />
      ) : null}
      {item.saved && renaming !== item.id ? (
        <MenuTrigger>
          <AriaButton
            className="layout-tile-menu"
            aria-label={`${item.name} options`}
            data-testid="tpl-menu"
          >
            <Icon name="moreHorizontal" size={14} />
          </AriaButton>
          <MenuPopover placement="bottom end" className="w-44">
            <Menu
              aria-label={`${item.name} options`}
              onAction={(key) => {
                if (key === 'rename') {
                  setRenaming(item.id)
                } else if (key === 'duplicate') {
                  duplicateSavedTemplate(item.id)
                } else {
                  deleteSavedTemplate(item.id)
                }
              }}
            >
              <MenuItem id="rename" data-testid="tpl-rename">
                <Icon name="pencil" size={14} />
                Rename…
              </MenuItem>
              <MenuItem id="duplicate" data-testid="tpl-duplicate">
                <Icon name="copy" size={14} />
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                id="delete"
                variant="destructive"
                data-testid="tpl-delete"
              >
                <Icon name="delete" size={14} />
                Delete
              </MenuItem>
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      ) : null}
    </div>
  )
  return (
    <Disclosure
      title="Layout"
      defaultExpanded
      note={note}
      data-testid="layout"
      right={
        <IconButton
          label="Save as template"
          size="sm"
          isDisabled={!canSave}
          data-testid="tpl-save"
          onPress={save}
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
        {/* Kit tabs / chips: uikit/src/sandbox/context-inspector.tsx:163-175
            (Owner 2026-11-02: no search field). Toggle buttons, not
            role=tablist: the inspector itself has no tabs. */}
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
            All <span className="layout-muted">{all.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === 'mine'}
            data-testid="tab-mine"
            onClick={() => {
              setTab('mine')
            }}
          >
            My templates <span className="layout-muted">{saved.length}</span>
          </button>
        </div>
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
        {list.length > 0 ? (
          <div
            className={`grid gap-1.5 ${
              thumbColumns(geometry.widthMm, geometry.heightMm) === 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
            }`}
            data-testid="tpl-grid"
          >
            {list.map(tile)}
          </div>
        ) : (
          <p
            className="layout-empty text-center text-xs"
            data-testid="tpl-empty"
          >
            <Icon
              name="layoutTemplate"
              size={16}
              className="layout-empty-icon"
            />
            {/* Unfiltered, only My templates can be empty. */}
            {chip === 'all'
              ? 'No templates yet. Save a spread you like.'
              : 'No layouts match.'}
          </p>
        )}
        <p className="layout-muted layout-caption m-0" data-testid="tpl-hint">
          Hover a layout to preview it on the spread; click to apply. Photos are
          kept in order.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          isDisabled={!canSave}
          data-testid="tpl-save-button"
          onPress={save}
        >
          <Icon name="plus" size={14} />
          Save as template
        </Button>
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
            // Unlayered `.pb-button { margin: 0 }` beats a plain utility.
            className="ml-auto!"
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

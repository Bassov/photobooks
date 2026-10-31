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
  templateName,
} from './layoutCatalog'
import { percentStyle, thumbPaperBox, thumbSlots } from './layoutThumb'
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

/** Kit LayoutSection shows at most three suggestions (context-inspector.tsx:143). */
const MAX_SUGGESTED = 3

function readBook() {
  return getBookStoreSnapshot().book
}

/** One tile: a kit builtin (`saved: false`) or one of the user's templates. */
interface LayoutItem {
  id: string
  name: string
  rects: readonly RectMm[]
  saved: boolean
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
  const mine = useSyncExternalStore(
    subscribeSavedTemplates,
    getSavedTemplates,
    getSavedTemplates,
  )
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(2)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [chip, setChip] = useState<LayoutChipId>('all')
  const [query, setQuery] = useState('')
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
    const builtins: LayoutItem[] = LAYOUT_PICKER.map((id: FixedTemplateId) => ({
      id,
      name: TEMPLATE_NAMES[id],
      rects: generateTemplateFrames(id, book, spreadIndex, spread).map(
        (frame) => frame.rect,
      ),
      saved: false,
    }))
    return {
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      spine: getSpreadPageCount(spreadIndex, book.spreads.length) === 2,
      builtins,
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
  const summary = templateName(current) ?? undefined
  // Kit: filled photo frames, else every frame of the spread.
  const filled = spread.frames.filter((f) => f.assetId !== undefined).length
  const photos = filled > 0 ? filled : spread.frames.length
  const wanted = query.trim().toLowerCase()
  const list = (tab === 'mine' ? saved : all).filter(
    (item) =>
      matchesChip(item.rects.length, chip) &&
      item.name.toLowerCase().includes(wanted),
  )
  const suggested =
    tab === 'all' && chip === 'all' && wanted === ''
      ? geometry.builtins
          .filter((item) => item.rects.length === photos && item.id !== current)
          .slice(0, MAX_SUGGESTED)
      : []
  // Kit `save`: the spread's photo frames become "My layout N", named inline.
  const save = () => {
    const slots = spreadLayoutSlots(readBook(), spreadId)
    if (slots.length === 0) {
      return
    }
    const added = addSavedTemplate(nextTemplateName(), slots)
    setTab('mine')
    setChip('all')
    setQuery('')
    setRenaming(added.id)
  }
  const canSave = spread.frames.some((frame) => frame.kind !== 'text')
  const tile = (item: LayoutItem, testId: string) => (
    <div key={item.id} className="layout-tile-cell">
      <button
        type="button"
        className="layout-tile"
        data-testid={testId}
        data-template={item.id}
        aria-pressed={current === item.id}
        aria-label={`${testId === 'layout-tile' ? 'Apply layout' : 'Apply suggested layout'} ${item.name}`}
        title={`${item.name} · ${photoLabel(item.rects.length)} — hover to preview, click to apply`}
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
        {renaming === item.id ? null : (
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
            if (renaming === item.id) {
              renameSavedTemplate(item.id, event.currentTarget.value)
              setRenaming(null)
            }
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
      summary={summary}
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
            <div className="layout-group-label mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Icon name="sparkles" size={14} className="layout-muted" />
              Suggested for {photoLabel(photos)}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {suggested.map((item) => tile(item, 'layout-suggested-tile'))}
            </div>
          </div>
        ) : null}
        <div>
          {suggested.length > 0 ? (
            <div className="layout-group-label mb-1.5 text-xs font-medium">
              All layouts
            </div>
          ) : null}
          {list.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5" data-testid="tpl-grid">
              {list.map((item) => tile(item, 'layout-tile'))}
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
              {tab === 'mine' && query === '' && chip === 'all'
                ? 'No templates yet. Save a spread you like.'
                : 'No layouts match.'}
            </p>
          )}
        </div>
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

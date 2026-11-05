import { useSyncExternalStore } from 'react'
import { effectiveGrid, isTemplateId, spreadParent } from '../core'
import { Disclosure } from '../ui/Disclosure'
import { Icon } from '../ui/Icon'
import { Select } from '../ui/Select'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { setFrameSource } from './frameSelection'
import { InspectorSlider } from './InspectorControls'
import { spreadMasterStatus } from './inspectorModel'
import { parentChanges, type ParentChange } from './parentChanges'
import { setLeftPanelTab, setPickedParentId } from './leftPanelTabStore'
import './SpreadSections.css'

/** Master choice for None (parent ids are never empty). */
const NO_PARENT = ''

/** Kit SpreadBgSection swatches (uikit/src/sandbox/sections.tsx:54). */
const BACKGROUNDS = [
  '#ffffff',
  '#f4f4f4',
  '#e9e9e9',
  '#e3e3e3',
  '#2a2927',
  '#111111',
] as const

/** Kit Margin / Gap slider ranges in mm (context-inspector.tsx:249-252). */
const MARGIN_MAX_MM = 30
const GAP_MAX_MM = 20

function readBook() {
  return getBookStoreSnapshot().book
}

function useSpread(spreadId: string) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  return { book, spread: book.spreads.find((item) => item.id === spreadId) }
}

/**
 * Kit SpreadPageSection: the spread's master page, and Margin / Gap that
 * re-flow its template. Margin sets all four grid margins of the spread and
 * Gap both gutters (the spread grid override the template is laid out on).
 */
export function MasterSpacingSection({ spreadId }: { spreadId: string }) {
  const { book, spread } = useSpread(spreadId)
  if (spread === undefined) {
    return null
  }
  const { values } = effectiveGrid(book, spread)
  const parents = book.parents ?? []
  const shown = spreadParent(book, spread)
  return (
    <Disclosure
      title="Master & spacing"
      defaultExpanded
      data-testid="spread-master-spacing"
    >
      <div className="px-4 pt-0.5 pb-3">
        {/* Owner amendment (default-master): always the Cover inspector select, the book's parents + None. */}
        {parents.length > 0 ? (
          <>
            <Select
              aria-label="Master"
              data-testid="spread-master-select"
              value={shown?.id ?? NO_PARENT}
              onChange={(id) => {
                dispatchBookOp({
                  type: 'setSpreadParent',
                  spreadId,
                  parentId: id === NO_PARENT ? null : id,
                })
              }}
              options={[
                ...parents.map((parent) => ({
                  value: parent.id,
                  label:
                    parent.id === book.defaultParentId
                      ? `${parent.name} · default`
                      : parent.name,
                })),
                { value: NO_PARENT, label: 'None' },
              ]}
            />
            <div
              className="spread-master-status"
              data-testid="spread-master-status"
            >
              <span>{spreadMasterStatus(book, spread)}</span>
              {shown === undefined ? null : (
                <button
                  type="button"
                  className="spread-master-edit"
                  data-testid="spread-master-edit"
                  onClick={() => {
                    // A frame picked on a page is not on the master canvas.
                    setFrameSource(null)
                    setPickedParentId(shown.id)
                    setLeftPanelTab('masters')
                  }}
                >
                  Edit master
                </button>
              )}
            </div>
          </>
        ) : null}
        <div className="spread-spacing" data-testid="spread-spacing">
          <InspectorSlider
            label="Margin"
            value={values.top}
            min={0}
            max={MARGIN_MAX_MM}
            unit="millimeter"
            testId="spread-margin"
            editableValue
            onChange={(mm) => {
              dispatchBookOp({
                type: 'setSpreadGrid',
                spreadId,
                patch: { top: mm, bottom: mm, inside: mm, outside: mm },
              })
            }}
          />
          <InspectorSlider
            label="Gap"
            value={values.columnGutterMm}
            min={0}
            max={GAP_MAX_MM}
            unit="millimeter"
            testId="spread-gap"
            editableValue
            onChange={(mm) => {
              dispatchBookOp({
                type: 'setSpreadGrid',
                spreadId,
                patch: { columnGutterMm: mm, rowGutterMm: mm },
              })
            }}
          />
        </div>
        {shown === undefined ? null : (
          <ParentChanges
            spreadId={spreadId}
            parentName={shown.name}
            changes={parentChanges(book, spread)}
          />
        )}
        {/* No template (`'undefined'`) and saved layouts do not re-flow. */}
        {!isTemplateId(String(spread.templateId)) ? (
          <p className="spread-spacing-note">
            Margin and gap re-flow template layouts
          </p>
        ) : null}
      </div>
    </Disclosure>
  )
}

/**
 * Designer parent-overrides PO7: what the spread changed from its parent,
 * each row with its own ↺, and Reset all. Absent without changes, so the
 * inspector of a spread that only inherits is unchanged.
 */
function ParentChanges({
  spreadId,
  parentName,
  changes,
}: {
  spreadId: string
  parentName: string
  changes: readonly ParentChange[]
}) {
  if (changes.length === 0) {
    return null
  }
  return (
    <div className="parent-changes" data-testid="parent-changes">
      <div className="parent-changes-head">
        <span>Changed from {parentName}</span>
        <button
          type="button"
          className="parent-reset-all"
          data-testid="parent-reset-all"
          onClick={() => {
            dispatchBookOp({ type: 'resetSpreadToParent', spreadId })
          }}
        >
          Reset all
        </button>
      </div>
      {changes.map((change) => {
        const label = `Reset ${change.name} to ${parentName}`
        return (
          <div
            key={change.parentItemId}
            className="parent-change-row"
            data-testid="parent-change-row"
          >
            <Icon
              name={change.state === 'override' ? 'unlink2' : 'eyeOff'}
              size={14}
            />
            <span className="parent-change-label">
              <span className="parent-change-name">{change.name}</span>
              <span className="parent-change-state">· {change.state}</span>
            </span>
            <button
              type="button"
              className="e7-ghost insp-grid-reset"
              aria-label={label}
              title={label}
              data-testid="parent-change-reset"
              onClick={() => {
                dispatchBookOp({
                  type: 'resetParentItem',
                  spreadId,
                  parentItemId: change.parentItemId,
                })
              }}
            >
              <Icon name="rotateCcw" size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Kit SpreadBgSection: six swatches, the spread's color ringed. */
export function BackgroundSection({ spreadId }: { spreadId: string }) {
  const { book, spread } = useSpread(spreadId)
  if (spread === undefined) {
    return null
  }
  const color =
    spread.backgroundColor ?? book.settings.pageColor ?? BACKGROUNDS[0]
  return (
    <Disclosure
      title="Background"
      defaultExpanded
      data-testid="spread-background"
    >
      <div className="px-4 pt-0.5 pb-3">
        <div
          className="flex gap-1.5"
          role="group"
          aria-label="Spread background"
          data-testid="bg-swatches"
        >
          {BACKGROUNDS.map((value) => (
            <button
              key={value}
              type="button"
              className="spread-bg-swatch"
              aria-label={`Background ${value}`}
              aria-pressed={color.toLowerCase() === value}
              data-swatch={value}
              style={{ background: value }}
              onClick={() => {
                dispatchBookOp({
                  type: 'setSpreadBackground',
                  spreadId,
                  color: value,
                })
              }}
            />
          ))}
        </div>
      </div>
    </Disclosure>
  )
}

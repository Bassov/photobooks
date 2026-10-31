import { useSyncExternalStore } from 'react'
import { effectiveGrid, type SpreadMasterId } from '../core'
import { Disclosure } from '../ui/Disclosure'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { InspectorSlider } from './InspectorControls'
import './SpreadSections.css'

/** Kit SpreadPageSection Master choices (context-inspector.tsx:246-247). */
const MASTERS: { id: SpreadMasterId; label: string }[] = [
  { id: 'A', label: 'Master A' },
  { id: 'B', label: 'Master B' },
  { id: 'none', label: 'None' },
]

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
  return (
    <Disclosure
      title="Master & spacing"
      defaultExpanded
      data-testid="spread-master-spacing"
    >
      <div className="px-4 pt-0.5 pb-3">
        <SegmentedControl
          label="Master"
          size="sm"
          className="spread-segmented"
          value={spread.masterId ?? 'A'}
          onChange={(next) => {
            const masterId = MASTERS.find((m) => m.id === next)?.id
            if (masterId !== undefined) {
              dispatchBookOp({ type: 'setSpreadMaster', spreadId, masterId })
            }
          }}
          items={MASTERS}
        />
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
        {spread.templateId === undefined ? (
          <p className="spread-spacing-note">
            Margin and gap re-flow template layouts
          </p>
        ) : null}
      </div>
    </Disclosure>
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

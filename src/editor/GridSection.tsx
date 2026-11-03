import { useState, useSyncExternalStore } from 'react'
import {
  effectiveGrid,
  hasGridOverride,
  spreadParent,
  type Book,
  type GridPatch,
  type ParentSpread,
  type Spread,
} from '../core'
import { Disclosure } from '../ui/Disclosure'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { SUB } from './editorChromeTokens'
import { GridFields } from './GridFields'
import {
  getGridVisible,
  setGridVisible,
  subscribeGridVisible,
} from './gridView'
import { ToggleSwitch } from './InspectorControls'
import {
  linkMarginsPatch,
  marginsEqual,
  masterGridPatch,
  resetGridFields,
} from './inspectorModel'
import './GridSection.css'

const SPREAD_TEST_IDS = {
  field: 'spread-grid-field',
  link: 'spread-grid-link',
  reset: 'spread-grid-reset',
} as const

function readBook() {
  return getBookStoreSnapshot().book
}

function useGridShown() {
  return useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
}

/**
 * Kit SpreadGridSection (context-inspector.tsx, Designer Spec GP1–GP6):
 * "Use master" / "Use book" (inherit) or Custom (per-field overrides on top
 * of the parent), and the shared Show grid switch.
 */
export function GridSection({ spreadId }: { spreadId: string | undefined }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const shown = useGridShown()
  // Custom with no override (just picked, or after ↺ on the last one).
  const [customFor, setCustomFor] = useState<string | null>(null)
  const spread = book.spreads.find((item) => item.id === spreadId)
  if (spread === undefined) {
    return null
  }
  const { values } = effectiveGrid(book, spread)
  const custom = hasGridOverride(spread) || customFor === spread.id
  const parent = spreadParent(book, spread)
  return (
    <Disclosure
      title="Grid"
      defaultExpanded
      summary={`${String(values.columns)}×${String(values.rows)}`}
      data-testid="grid"
    >
      <div
        className="grid-section grid-section-spread px-4 pt-0.5 pb-3"
        data-testid="grid-section-spread"
        role="group"
        aria-label="Grid"
      >
        <SegmentedControl
          label="Grid source"
          className="grid-source"
          value={custom ? 'custom' : 'inherit'}
          onChange={(next) => {
            if (next === 'custom') {
              setCustomFor(spread.id)
              return
            }
            setCustomFor(null)
            dispatchBookOp({ type: 'resetSpreadGrid', spreadId: spread.id })
          }}
          items={[
            {
              id: 'inherit',
              label: parent === undefined ? 'Use book' : 'Use master',
            },
            { id: 'custom', label: 'Custom' },
          ]}
        />
        <div className="mt-3">
          {custom ? (
            <SpreadGridCustom
              key={spread.id}
              book={book}
              spread={spread}
              parent={parent}
              onReset={() => {
                setCustomFor(spread.id)
              }}
            />
          ) : (
            <p
              className="grid-section-muted m-0 text-sm"
              data-testid="spread-grid-inherit"
            >
              {`${parent?.name ?? 'Book grid'} · ${String(values.columns)} × ${String(values.rows)} · gutter ${String(values.columnGutterMm)} mm · margins ${String(values.top)}/${String(values.bottom)}/${String(values.inside)}/${String(values.outside)} mm`}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="grid-section-muted">Show grid</span>
          <ToggleSwitch
            label="Show grid"
            on={shown}
            onChange={setGridVisible}
            testId="grid-toggle"
          />
        </div>
      </div>
    </Disclosure>
  )
}

/**
 * Custom (GP2–GP6): grey fields follow the parent, dark 600 + ↺ are set on
 * this spread. Mounted per spread: the link starts on when margins match.
 */
function SpreadGridCustom({
  book,
  spread,
  parent,
  onReset,
}: {
  book: Book
  spread: Spread
  parent: ParentSpread | undefined
  onReset: () => void
}) {
  const { values, source } = effectiveGrid(book, spread)
  const [linked, setLinked] = useState(() => marginsEqual(values))
  const write = (patch: GridPatch) => {
    dispatchBookOp({ type: 'setSpreadGrid', spreadId: spread.id, patch })
  }
  return (
    <>
      <GridFields
        values={values}
        linked={linked}
        testIds={SPREAD_TEST_IDS}
        onCommit={(field, value) => {
          write(masterGridPatch(field, value, linked))
        }}
        onLinkedChange={(next) => {
          const patch = next ? linkMarginsPatch(values) : null
          if (patch !== null) {
            write(patch)
          }
          setLinked(next)
        }}
        inheritance={{
          source,
          parentName: parent?.name ?? 'book grid',
          onReset: (field) => {
            onReset()
            dispatchBookOp({
              type: 'resetSpreadGridFields',
              spreadId: spread.id,
              fields: resetGridFields(field, linked),
            })
          },
        }}
      />
      <div
        className="mt-1.5 text-2xs leading-4"
        style={{ color: SUB }}
        data-testid="spread-grid-hint"
      >
        {`Grey values follow ${parent?.name ?? 'the book grid'}.`}
      </div>
    </>
  )
}

import { useState, useSyncExternalStore } from 'react'
import {
  effectiveGrid,
  pageNumberPosition,
  parentAsSpread,
  type GridPatch,
  type PageNumberPosition,
} from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { SegmentedControl } from '../ui/SegmentedControl'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { setCoverSelected } from './coverSelection'
import { SUB } from './editorChromeTokens'
import { GridFields } from './GridFields'
import {
  InspectorHead,
  InspectorRow,
  InspectorSec,
  ToggleSwitch,
} from './InspectorControls'
import {
  marginsEqual,
  masterGridPatch,
  masterPageNumbersHint,
  masterUsageLabel,
  parentUsage,
} from './inspectorModel'

const MASTER_TEST_IDS = {
  field: 'master-field',
  link: 'master-field-link',
  reset: 'master-field-reset',
} as const

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * Kit master inspector (uikit/src/sandbox/v7.tsx:231-233): head (name, usage)
 * and the GRID section. Every commit is one `setSpreadGrid` on the parent.
 * Mount per parent (`key`): the margin link starts on when all four match.
 */
export function MasterSection({ parentId }: { parentId: string }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const parent = book.parents?.find((item) => item.id === parentId)
  const { values } = effectiveGrid(
    book,
    parent === undefined ? undefined : parentAsSpread(parent),
  )
  const [linked, setLinked] = useState(() => marginsEqual(values))
  if (parent === undefined) {
    return null
  }
  const write = (patch: GridPatch) => {
    dispatchBookOp({ type: 'setSpreadGrid', spreadId: parent.id, patch })
  }
  return (
    <section data-testid="insp-master" aria-label="Master">
      <InspectorHead
        title={parent.name}
        sub={masterUsageLabel(book, parent.id)}
        subTestId="master-usage"
      >
        {parent.id === book.defaultParentId ? null : (
          <>
            {parentUsage(book, parent.id) === 0 ? (
              <p className="master-hint" data-testid="master-hint">
                Pick it for a spread under Master &amp; spacing, or make it the
                default.
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="master-make-default"
              data-testid="master-make-default"
              onPress={() => {
                dispatchBookOp({
                  type: 'setDefaultParent',
                  parentId: parent.id,
                })
              }}
            >
              <Icon name="check" size={14} />
              Make default
            </Button>
          </>
        )}
      </InspectorHead>
      <InspectorSec title="Grid" testId="master-grid">
        <GridFields
          values={values}
          linked={linked}
          testIds={MASTER_TEST_IDS}
          onCommit={(field, value) => {
            write(masterGridPatch(field, value, linked))
          }}
          onLinkedChange={(next) => {
            if (next) {
              write({
                bottom: values.top,
                inside: values.top,
                outside: values.top,
              })
            }
            setLinked(next)
          }}
        />
      </InspectorSec>
      <MasterPageNumbers
        parentId={parent.id}
        position={pageNumberPosition(parent)}
        hint={masterPageNumbersHint(book)}
      />
    </section>
  )
}

const POSITIONS: { id: PageNumberPosition; label: string }[] = [
  { id: 'outer', label: 'Outer' },
  { id: 'centre', label: 'Centre' },
  { id: 'inner', label: 'Inner' },
]

/** As the top-bar title: Book settings replaces the other inspector contexts. */
function openBookSettings(): void {
  setCoverSelected(false)
  setBookSettingsSelected(true)
}

/**
 * Designer page-numbers (kit v7.tsx:292-295): Show switch, then (on only)
 * the Outer / Centre / Inner segments and the hint linking to Book settings.
 */
function MasterPageNumbers({
  parentId,
  position,
  hint,
}: {
  parentId: string
  position: PageNumberPosition | null
  hint: string
}) {
  const write = (next: PageNumberPosition | null) => {
    dispatchBookOp({ type: 'setParentPageNumbers', parentId, position: next })
  }
  return (
    <InspectorSec title="Page numbers" testId="master-page-numbers">
      <InspectorRow label="Show">
        <ToggleSwitch
          label="Page numbers"
          testId="master-pn-toggle"
          on={position !== null}
          onChange={(on) => {
            write(on ? 'outer' : null)
          }}
        />
      </InspectorRow>
      {position === null ? null : (
        <>
          <div className="mt-3" data-testid="master-pn-position">
            <SegmentedControl
              label="Page number position"
              size="inspector"
              items={POSITIONS}
              value={position}
              onChange={write}
            />
          </div>
          <div
            className="mt-1.5 text-2xs leading-[1.35]"
            style={{ color: SUB }}
            data-testid="master-pn-note"
          >
            {hint} ·{' '}
            <button
              type="button"
              className="master-pn-link"
              data-testid="master-pn-book-settings"
              onClick={openBookSettings}
            >
              Book settings
            </button>
          </div>
        </>
      )}
    </InspectorSec>
  )
}

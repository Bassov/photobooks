import { useState, useSyncExternalStore } from 'react'
import { effectiveGrid, parentAsSpread, type GridPatch } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { GridFields } from './GridFields'
import { InspectorHead, InspectorSec } from './InspectorControls'
import {
  marginsEqual,
  masterGridPatch,
  parentUsage,
  parentUsageLabel,
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
        sub={parentUsageLabel(parentUsage(book, parent.id))}
        subTestId="master-usage"
      />
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
    </section>
  )
}

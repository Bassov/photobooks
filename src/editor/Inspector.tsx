import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  getAssetDisplayName,
  getBookStoreSnapshot,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import { getCropTarget, getCropTargetKey, subscribeCropMode } from './cropMode'
import { SUB, T } from './editorChromeTokens'
import { FitCropSection } from './FitCropSection'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import { GridSection } from './GridSection'
import {
  framePhotoRows,
  inspectorView,
  sameInspectorPanel,
  spreadRows,
  spreadTitle,
  type InspectorPanel,
  type InspectorRow,
} from './inspectorModel'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'

const EMPTY_HINT = 'Select a spread or a photo to see its properties.'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit InspectorPanel: BAR surface, quiet header, rows follow the selection. */
export function Inspector({ onCollapse }: { onCollapse?: () => void }) {
  const frameSource = useSyncExternalStore(
    subscribeFrameSelection,
    getFrameSource,
    getFrameSource,
  )
  const activeId = useSyncExternalStore(
    subscribeActiveSpreadId,
    getActiveSpreadId,
    getActiveSpreadId,
  )
  const cropKey = useSyncExternalStore(
    subscribeCropMode,
    getCropTargetKey,
    getCropTargetKey,
  )
  const target = cropKey === '' ? null : getCropTarget()
  // Esc drops the spread view to the empty hint until another spread is picked.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [tab, setTab] = useState<'spread' | 'book'>('spread')
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissed(getActiveSpreadId())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  // Crop pans commit the book every pointermove; keep the previous snapshot
  // while header and rows are unchanged so the (often hidden) panel skips it.
  const lastPanel = useRef<InspectorPanel | null>(null)
  const readPanel = useCallback(() => {
    const next = inspectorPanel(frameSource, activeId, dismissed)
    const prev = lastPanel.current
    if (prev !== null && sameInspectorPanel(prev, next)) {
      return prev
    }
    lastPanel.current = next
    return next
  }, [frameSource, activeId, dismissed])
  const panel = useSyncExternalStore(subscribeBookStore, readPanel, readPanel)
  const { kind, rows } = panel
  // Crop mode keeps its frame (double-click drops the selection); else the
  // selected frame. Empty frames render nothing inside the section.
  const section = target ?? frameSource
  return (
    <section
      className="editor-inspector-panel flex min-h-full flex-col"
      aria-label="Inspector"
      data-testid="inspector-panel"
      data-inspector-view={kind}
      style={{ color: T }}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3">
        <span
          className="min-w-0 truncate text-[13px] font-medium"
          data-testid="inspector-name"
        >
          {panel.name}
        </span>
        {panel.meta ? (
          <span className="text-xs" style={{ color: SUB }}>
            {panel.meta}
          </span>
        ) : null}
        {onCollapse ? (
          <div className="ml-auto flex items-center" style={{ color: SUB }}>
            <IconButton
              label="Collapse inspector ]"
              size="sm"
              placement="left"
              onPress={onCollapse}
              data-testid="panel-collapse-right"
            >
              <Icon name="panelRight" />
            </IconButton>
          </div>
        ) : null}
      </header>
      <div className="px-3 pb-2">
        <SegmentedControl
          label="Inspector tab"
          size="sm"
          value={tab}
          onChange={(next) => {
            setTab(next === 'book' ? 'book' : 'spread')
          }}
          items={[
            { id: 'spread', label: 'Spread' },
            { id: 'book', label: 'Book' },
          ]}
        />
      </div>
      <div className="px-3 pb-4" data-testid={`inspector-tab-${tab}`}>
        {tab === 'book' ? (
          <GridSection scope="book" />
        ) : kind === 'empty' ? (
          <p
            className="text-[12.5px] leading-snug"
            style={{ color: SUB }}
            data-testid="inspector-empty"
          >
            {EMPTY_HINT}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
            {rows.map((row) => (
              <Row key={row.label} row={row} />
            ))}
          </dl>
        )}
        {tab === 'book' || section === null ? null : (
          <FitCropSection target={section} cropping={target !== null} />
        )}
        {tab === 'spread' && panel.spreadId !== null ? (
          <div className="mt-4">
            <GridSection scope="spread" spreadId={panel.spreadId} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function inspectorPanel(
  frameSource: ReturnType<typeof getFrameSource>,
  activeId: ReturnType<typeof getActiveSpreadId>,
  dismissed: string | null,
): InspectorPanel {
  const book = readBook()
  const view = inspectorView(book, frameSource, activeId, dismissed)
  if (view.kind === 'spread') {
    return {
      kind: view.kind,
      name: spreadTitle(view.spreadIndex),
      meta: 'Spread',
      spreadId: view.spread.id,
      rows: spreadRows(view.spread),
    }
  }
  if (view.kind === 'frame') {
    const assetId = view.frame.assetId
    return {
      kind: view.kind,
      name:
        assetId === undefined ? 'Empty frame' : getAssetDisplayName(assetId),
      meta: 'Photo',
      spreadId: view.spread.id,
      rows: framePhotoRows(
        book,
        view.frame,
        view.spreadIndex,
        assetId === undefined ? 0 : getPlacementCountSnapshot(assetId),
      ),
    }
  }
  return {
    kind: view.kind,
    name: 'Inspector',
    meta: '',
    spreadId: null,
    rows: [],
  }
}

function Row({ row }: { row: InspectorRow }) {
  return (
    <>
      <dt style={{ color: SUB }}>{row.label}</dt>
      <dd className="truncate text-right tabular-nums" title={row.value}>
        {row.value}
      </dd>
    </>
  )
}

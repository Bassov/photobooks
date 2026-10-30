import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  getBookStoreSnapshot,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import { CoverSection } from './CoverSection'
import { isCoverSelected, subscribeCoverSelection } from './coverSelection'
import {
  isBookSettingsSelected,
  subscribeBookSettingsSelection,
} from './bookSettingsSelection'
import { BookSettingsSection } from './BookSettingsSection'
import { getCropTarget, getCropTargetKey, subscribeCropMode } from './cropMode'
import { SUB, T } from './editorChromeTokens'
import { FitCropSection } from './FitCropSection'
import {
  ArrangeSection,
  DeleteFrameButton,
  GeometrySection,
} from './FrameSections'
import { Disclosure } from '../ui/Disclosure'
import { PhotoRotateSection } from './PhotoRotateSection'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import { PhotoSection } from './PhotoSection'
import { GridSection } from './GridSection'
import { LayoutSection } from './LayoutSection'
import {
  framePhotoRows,
  inspectorView,
  sameInspectorPanel,
  spreadRows,
  spreadSummary,
  type InspectorPanel,
  type InspectorRow,
} from './inspectorModel'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'

const EMPTY_HINT = 'Select a spread or a photo to see its properties.'

/** What the panel shows: the selection-driven context (kit InspectorPanel). */
type InspectorContext =
  | InspectorPanel
  | { kind: 'cover' }
  | { kind: 'book' }
  | {
      kind: 'photo'
      target: NonNullable<ReturnType<typeof getFrameSource>>
      rows: readonly InspectorRow[]
    }

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
  const coverSelected = useSyncExternalStore(
    subscribeCoverSelection,
    isCoverSelected,
    isCoverSelected,
  )
  const bookSelected = useSyncExternalStore(
    subscribeBookSettingsSelection,
    isBookSettingsSelected,
    isBookSettingsSelected,
  )
  const target = cropKey === '' ? null : getCropTarget()
  // Esc drops the spread view to the empty hint until another spread is picked.
  const [dismissed, setDismissed] = useState<string | null>(null)
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
  // Crop mode keeps its frame (double-click drops the selection); else the
  // selected frame. Empty frames render nothing inside the section.
  const section = coverSelected || bookSelected ? null : (target ?? frameSource)
  const view: InspectorContext = coverSelected
    ? { kind: 'cover' }
    : bookSelected
      ? { kind: 'book' }
      : section === null
        ? panel
        : {
            kind: 'photo',
            target: section,
            rows: panel.kind === 'frame' ? panel.rows : [],
          }
  return (
    <section
      className="editor-inspector-panel flex h-full min-h-0 flex-col"
      aria-label="Inspector"
      data-testid="inspector-panel"
      data-inspector-view={view.kind === 'photo' ? 'frame' : view.kind}
      style={{ color: T }}
    >
      {onCollapse ? (
        <div
          className="flex h-12 shrink-0 items-center justify-end pr-1.5 pl-2"
          style={{ color: SUB }}
        >
          <IconButton
            label="Hide inspector (I)"
            size="sm"
            placement="left"
            onPress={onCollapse}
            data-testid="panel-collapse-right"
          >
            <Icon name="panelRight" />
          </IconButton>
        </div>
      ) : null}
      <div
        className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        data-testid="inspector-body"
      >
        {view.kind === 'cover' ? <CoverSection /> : null}
        {view.kind === 'book' ? (
          <>
            <BookSettingsSection />
            <GridSection scope="book" />
          </>
        ) : null}
        {view.kind === 'photo' ? (
          <>
            <h2
              className="inspector-context-title"
              data-testid="inspector-context"
            >
              Photo
            </h2>
            <PhotoSection target={view.target} />
            {view.rows.length === 0 ? null : (
              <div className="px-4 pb-4">
                <RowList rows={view.rows} />
              </div>
            )}
            <FitCropSection target={view.target} cropping={target !== null} />
            <PhotoRotateSection target={view.target} />
            <Disclosure
              title="Position & size"
              data-testid="inspector-geometry-disclosure"
            >
              <GeometrySection target={view.target} />
            </Disclosure>
            <Disclosure
              title="Arrange"
              data-testid="inspector-arrange-disclosure"
            >
              <ArrangeSection target={view.target} />
            </Disclosure>
            <DeleteFrameButton target={view.target} />
          </>
        ) : null}
        {view.kind === 'spread' ? (
          <>
            <h2
              className="inspector-context-title"
              data-testid="inspector-context"
            >
              Spread
            </h2>
            <SpreadSummary spreadId={view.spreadId} />
            <div className="px-4 py-4">
              <div
                className="inspector-eyebrow mb-3"
                data-testid="inspector-spread-properties"
              >
                Spread properties
              </div>
              <RowList rows={view.spreadRows} />
            </div>
            <LayoutSection spreadId={view.spreadId} />
            <GridSection scope="spread" spreadId={view.spreadId} />
          </>
        ) : null}
        {view.kind === 'empty' ? <Hint>{EMPTY_HINT}</Hint> : null}
      </div>
    </section>
  )
}

/** Kit Spread header line: "Pages 2–3 · 1 empty". */
function SpreadSummary({ spreadId }: { spreadId: string }) {
  const read = () => spreadSummary(readBook(), spreadId)
  const line = useSyncExternalStore(subscribeBookStore, read, read)
  return (
    <p
      className="px-4 pt-0.5 text-xs"
      style={{ color: SUB }}
      data-testid="inspector-spread-summary"
    >
      {line}
    </p>
  )
}

function Hint({ children }: { children: string }) {
  return (
    <p
      className="px-4 py-4 text-[12.5px] leading-snug"
      style={{ color: SUB }}
      data-testid="inspector-empty"
    >
      {children}
    </p>
  )
}

function RowList({ rows }: { rows: readonly InspectorRow[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
      {rows.map((row) => (
        <Row key={row.label} row={row} />
      ))}
    </dl>
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
      spreadId: view.spread.id,
      spreadRows: spreadRows(view.spread),
    }
  }
  if (view.kind === 'frame') {
    const assetId = view.frame.assetId
    return {
      kind: view.kind,
      spreadId: view.spread.id,
      spreadRows: spreadRows(view.spread),
      rows: framePhotoRows(
        book,
        view.frame,
        view.spreadIndex,
        assetId === undefined ? 0 : getPlacementCountSnapshot(assetId),
      ),
    }
  }
  return { kind: view.kind }
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

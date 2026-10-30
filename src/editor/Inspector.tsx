import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  getBookStoreSnapshot,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import { CoverSection } from './CoverSection'
import {
  isCoverSelected,
  setCoverSelected,
  subscribeCoverSelection,
} from './coverSelection'
import { BookSettingsSection } from './BookSettingsSection'
import { getCropTarget, getCropTargetKey, subscribeCropMode } from './cropMode'
import { SUB, T } from './editorChromeTokens'
import { FitCropSection } from './FitCropSection'
import {
  ArrangeSection,
  DeleteFrameButton,
  GeometrySection,
} from './FrameSections'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import { GridSection } from './GridSection'
import { LayoutSection } from './LayoutSection'
import {
  framePhotoRows,
  inspectorView,
  sameInspectorPanel,
  spreadRows,
  type InspectorPanel,
  type InspectorRow,
} from './inspectorModel'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'

const EMPTY_HINT = 'Select a spread or a photo to see its properties.'
const FRAME_HINT = 'Select a frame to edit it.'

type InspectorTab = 'frame' | 'spread' | 'book'

const TABS: readonly { id: InspectorTab; label: string }[] = [
  { id: 'frame', label: 'Frame' },
  { id: 'spread', label: 'Spread' },
  { id: 'book', label: 'Book' },
]

function isInspectorTab(key: unknown): key is InspectorTab {
  return TABS.some((item) => item.id === key)
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
  const target = cropKey === '' ? null : getCropTarget()
  // Esc drops the spread view to the empty hint until another spread is picked.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [tab, setTab] = useState<InspectorTab>('frame')
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
  const { kind } = panel
  // Crop mode keeps its frame (double-click drops the selection); else the
  // selected frame. Empty frames render nothing inside the section.
  const section = target ?? frameSource
  // Picking a frame (or entering crop on one) jumps to the Frame tab; picking
  // a spread leaves the user's tab alone.
  const sectionKey =
    section === null ? '' : `${section.spreadId}/${section.frameId}`
  const [seenKey, setSeenKey] = useState(sectionKey)
  if (seenKey !== sectionKey) {
    setSeenKey(sectionKey)
    if (sectionKey !== '') {
      setTab('frame')
    }
  }
  return (
    <section
      className="editor-inspector-panel flex h-full min-h-0 flex-col"
      aria-label="Inspector"
      data-testid="inspector-panel"
      data-inspector-view={kind}
      style={{ color: T }}
    >
      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={coverSelected ? 'frame' : tab}
        onSelectionChange={(key) => {
          setCoverSelected(false)
          if (isInspectorTab(key)) {
            setTab(key)
          }
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-1.5 pr-1.5 pl-2">
          <TabList
            aria-label="Inspector"
            className="editor-inspector-tabs grid flex-1"
            style={{
              gridTemplateColumns: `repeat(${String(TABS.length)}, minmax(0, 1fr))`,
            }}
          >
            {TABS.map((item) => (
              <Tab
                key={item.id}
                id={item.id}
                className="editor-inspector-tab"
                data-testid={`inspector-tab-${item.id}`}
              >
                {item.label}
              </Tab>
            ))}
          </TabList>
          {onCollapse ? (
            <div className="flex items-center" style={{ color: SUB }}>
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
        </div>
        <TabPanel
          id="frame"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
          data-testid="inspector-panel-frame"
        >
          {coverSelected ? <CoverSection /> : null}
          {!coverSelected && panel.kind === 'frame' ? (
            <>
              <h2
                className="inspector-context-title"
                data-testid="inspector-context"
              >
                Photo
              </h2>
              <div className="px-4 py-4">
                <RowList rows={panel.rows} />
              </div>
            </>
          ) : null}
          {!coverSelected && panel.kind === 'spread' ? (
            <>
              <h2
                className="inspector-context-title"
                data-testid="inspector-context"
              >
                Spread
              </h2>
              <div className="px-4 py-4">
                <div
                  className="inspector-eyebrow mb-3"
                  data-testid="inspector-spread-properties"
                >
                  Spread properties
                </div>
                <RowList rows={panel.spreadRows} />
              </div>
            </>
          ) : null}
          {!coverSelected && panel.kind === 'empty' ? (
            <Hint>{EMPTY_HINT}</Hint>
          ) : null}
          {!coverSelected && panel.kind === 'spread' && section === null ? (
            <Hint>{FRAME_HINT}</Hint>
          ) : null}
          {coverSelected || section === null ? null : (
            <>
              <GeometrySection target={section} />
              <FitCropSection target={section} cropping={target !== null} />
              <ArrangeSection target={section} />
              <DeleteFrameButton target={section} />
            </>
          )}
        </TabPanel>
        <TabPanel
          id="spread"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
          data-testid="inspector-panel-spread"
        >
          {panel.kind === 'empty' ? (
            <Hint>{EMPTY_HINT}</Hint>
          ) : (
            <>
              <div className="px-4 py-4">
                <RowList rows={panel.spreadRows} />
              </div>
              <LayoutSection spreadId={panel.spreadId} />
              <GridSection scope="spread" spreadId={panel.spreadId} />
            </>
          )}
        </TabPanel>
        <TabPanel
          id="book"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
          data-testid="inspector-panel-book"
        >
          <BookSettingsSection />
          <GridSection scope="book" />
        </TabPanel>
      </Tabs>
    </section>
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

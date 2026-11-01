import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/icons/glyphs'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { CoverSection } from './CoverSection'
import { isCoverSelected, subscribeCoverSelection } from './coverSelection'
import {
  isBookSettingsSelected,
  subscribeBookSettingsSelection,
} from './bookSettingsSelection'
import { BookSettingsSection } from './BookSettingsSection'
import { EndpaperSection } from './EndpaperSection'
import {
  getSelectedEndpaper,
  subscribeEndpaperSelection,
  type EndpaperSide,
} from './endpaperSelection'
import { getCropTarget, getCropTargetKey, subscribeCropMode } from './cropMode'
import { SUB, T } from './editorChromeTokens'
import { FitCropSection } from './FitCropSection'
import { PhotoFrameSections } from './PhotoFrameSections'
import { PhotoRotateSection } from './PhotoRotateSection'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import { PhotoSection } from './PhotoSection'
import { GridSection } from './GridSection'
import { LayoutSection } from './LayoutSection'
import { BackgroundSection, MasterSpacingSection } from './SpreadSections'
import {
  inspectorView,
  sameInspectorPanel,
  spreadSummary,
  type InspectorPanel,
} from './inspectorModel'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'

const EMPTY_HINT = 'Select a spread or a photo to see its properties.'

/** What the panel shows: the selection-driven context (kit InspectorPanel). */
type InspectorContext =
  | InspectorPanel
  | { kind: 'cover' }
  | { kind: 'book' }
  | { kind: 'endpaper'; side: EndpaperSide }
  | {
      kind: 'photo'
      target: NonNullable<ReturnType<typeof getFrameSource>>
    }

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit META (context-inspector.tsx:26-29) for the contexts with a shell header. */
const CONTEXT_HEADER: Partial<
  Record<InspectorContext['kind'], { title: string; icon: IconName }>
> = {
  spread: { title: 'Spread', icon: 'bookOpen' },
  photo: { title: 'Photo', icon: 'image' },
}

/** Kit InspectorPanel: BAR surface, quiet header, rows follow the selection. */
export function Inspector() {
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
  const endpaperSide = useSyncExternalStore(
    subscribeEndpaperSelection,
    getSelectedEndpaper,
    getSelectedEndpaper,
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
  const section =
    coverSelected || bookSelected || endpaperSide !== null
      ? null
      : (target ?? frameSource)
  const view: InspectorContext = coverSelected
    ? { kind: 'cover' }
    : endpaperSide !== null
      ? { kind: 'endpaper', side: endpaperSide }
      : bookSelected
        ? { kind: 'book' }
        : section === null
          ? panel
          : { kind: 'photo', target: section }
  const context = CONTEXT_HEADER[view.kind] ?? null
  return (
    <section
      className="editor-inspector-panel flex h-full min-h-0 flex-col"
      aria-label="Inspector"
      data-testid="inspector-panel"
      data-inspector-view={view.kind === 'photo' ? 'frame' : view.kind}
      style={{ color: T }}
    >
      {context === null ? null : (
        // Kit InspectorShell header (uikit/src/sandbox/context-inspector.tsx:35-42)
        // without its "Hide inspector" button: Owner Must M54 (round 7) keeps
        // only the top-bar toggle, so Cover / Endpaper / Book open on their
        // own section heads (M48).
        <div
          className="flex h-12 shrink-0 items-center gap-2 pr-2 pl-4"
          data-testid="inspector-header"
        >
          <span className="inspector-context-icon" style={{ color: SUB }}>
            <Icon name={context.icon} />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <h2
              className="inspector-context-title"
              data-testid="inspector-context"
            >
              {context.title}
            </h2>
            {view.kind === 'spread' ? (
              <SpreadSummary spreadId={view.spreadId} />
            ) : null}
          </div>
        </div>
      )}
      <div
        className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        data-testid="inspector-body"
      >
        {view.kind === 'cover' ? <CoverSection /> : null}
        {view.kind === 'endpaper' ? <EndpaperSection side={view.side} /> : null}
        {view.kind === 'book' ? <BookSettingsSection /> : null}
        {view.kind === 'photo' ? (
          <>
            <PhotoSection target={view.target} />
            <FitCropSection target={view.target} cropping={target !== null} />
            <PhotoRotateSection target={view.target} />
            <PhotoFrameSections target={view.target} />
          </>
        ) : null}
        {view.kind === 'spread' ? (
          <>
            {/* Kit spread context order (context-inspector.tsx:58-63). */}
            <LayoutSection spreadId={view.spreadId} />
            <MasterSpacingSection spreadId={view.spreadId} />
            <BackgroundSection spreadId={view.spreadId} />
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
      className="m-0 truncate text-2xs"
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

function inspectorPanel(
  frameSource: ReturnType<typeof getFrameSource>,
  activeId: ReturnType<typeof getActiveSpreadId>,
  dismissed: string | null,
): InspectorPanel {
  const view = inspectorView(readBook(), frameSource, activeId, dismissed)
  return view.kind === 'empty'
    ? { kind: view.kind }
    : { kind: view.kind, spreadId: view.spread.id }
}

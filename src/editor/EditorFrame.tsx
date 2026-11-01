import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Icon } from '../ui/Icon'
import { PanelSplitter } from '../ui/PanelSplitter'
import { loadPanelWidth, savePanelWidth } from '../ui/panelSize'
import { DEFAULT_EDITOR_PANELS, type EditorPanels } from './editorChromePanels'
import { ensureEditorChromeStyles, SUB } from './editorChromeTokens'
import {
  getEditorTool,
  subscribeEditorTool,
  type EditorTool,
} from './editorToolStore'
import { installEditorChromeKeys } from './installEditorChromeKeys'
import { installEditorGridKeys } from './installEditorGridKeys'
import { installEditorRotateKeys } from './installEditorRotateKeys'
import { installEditorToolKeys } from './installEditorToolKeys'

export type { EditorPanels } from './editorChromePanels'

const TOOL_CURSOR: Record<EditorTool, string | null> = {
  select: null,
  frame: 'cursor-tool-frame',
  text: 'cursor-tool-text',
  hand: 'cursor-grab',
}

export function EditorFrame({
  top,
  left,
  right,
  dock,
  canvas,
  overlay,
  panels,
  onPanelsChange,
  className,
}: {
  top?: ReactNode
  left: ReactNode
  /** Render prop receives the frame's collapse (state + focus hand-off). */
  right: PanelSlotContent
  dock: ReactNode
  canvas: ReactNode
  overlay?: ReactNode
  panels?: EditorPanels
  onPanelsChange?: (next: EditorPanels) => void
  className?: string
}) {
  ensureEditorChromeStyles()
  const [internal, setInternal] = useState(DEFAULT_EDITOR_PANELS)
  const pn = panels ?? internal
  const setPn = onPanelsChange ?? setInternal
  const pnRef = useRef(pn)

  useEffect(() => {
    pnRef.current = pn
  }, [pn])

  const [spaceDown, setSpaceDown] = useState(false)
  const tool = useSyncExternalStore(
    subscribeEditorTool,
    getEditorTool,
    getEditorTool,
  )
  // Space-pan keeps its own grab cursor, so the tool cursor yields to it.
  const toolCursor = spaceDown ? null : TOOL_CURSOR[tool]
  const [widthL, setWidthL] = useState(() => loadPanelWidth('left'))
  const [widthR, setWidthR] = useState(() => loadPanelWidth('right'))
  // The focused splitter / header button goes inert: hand focus to the toggle.
  const close = (k: 'l' | 'r') => {
    setPn({ ...pnRef.current, [k]: false })
    document.querySelector<HTMLElement>(`[data-panel-toggle="${k}"]`)?.focus()
  }
  const closeL = () => {
    close('l')
  }
  const closeR = () => {
    close('r')
  }

  useEffect(() => {
    const offChrome = installEditorChromeKeys({
      getPanels: () => pnRef.current,
      setPanels: setPn,
      setSpaceDown,
    })
    const offTool = installEditorToolKeys()
    const offGrid = installEditorGridKeys()
    const offRotate = installEditorRotateKeys()
    return () => {
      offChrome()
      offTool()
      offGrid()
      offRotate()
    }
  }, [setPn])

  return (
    <div
      className={['e7', 'editor-shell', className].filter(Boolean).join(' ')}
      data-testid="editor-shell"
      style={
        {
          '--panel-left': `${String(widthL)}px`,
          '--panel-right': `${String(widthR)}px`,
        } as CSSProperties
      }
    >
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="editor"
      >
        {top}
        <div className="flex min-h-0 flex-1">
          <div
            className="e7-pan editor-panel-l shrink-0 overflow-hidden"
            data-open={pn.l ? 'true' : 'false'}
            aria-hidden={pn.l ? undefined : true}
            inert={pn.l ? undefined : true}
            data-hidden-panel={pn.l ? undefined : true}
            data-testid="panel-l"
          >
            <div className="editor-panel-l-inner h-full">{left}</div>
          </div>
          {pn.l ? (
            <PanelSplitter
              side="left"
              width={widthL}
              onResize={setWidthL}
              onCommit={(w) => {
                savePanelWidth('left', w)
              }}
              onCollapse={closeL}
            />
          ) : null}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className={[
                'e7-canvas editor-workspace relative flex min-h-0 flex-1 flex-col overflow-hidden',
                toolCursor,
              ]
                .filter(Boolean)
                .join(' ')}
              data-tool={tool}
              data-testid="canvas"
              data-workspace="editor-workspace"
              tabIndex={0}
              aria-label="Canvas"
              data-panning={spaceDown ? 'true' : undefined}
            >
              <div
                className="editor-canvas-inner relative flex min-h-0 flex-1 flex-col overflow-hidden"
                data-testid="editor-workspace"
              >
                {canvas}
              </div>
            </div>
            <div
              className="e7-pan editor-panel-b shrink-0 overflow-hidden"
              data-open={pn.b ? 'true' : 'false'}
              aria-hidden={pn.b ? undefined : true}
              inert={pn.b ? undefined : true}
              data-hidden-panel={pn.b ? undefined : true}
              data-testid="panel-b"
            >
              {dock}
            </div>
          </main>
          {pn.r ? (
            <PanelSplitter
              side="right"
              width={widthR}
              onResize={setWidthR}
              onCommit={(w) => {
                savePanelWidth('right', w)
              }}
              onCollapse={closeR}
            />
          ) : null}
          <div
            className="e7-pan editor-panel-r shrink-0 overflow-hidden"
            data-open={pn.r ? 'true' : 'false'}
            aria-hidden={pn.r ? undefined : true}
            inert={pn.r ? undefined : true}
            data-hidden-panel={pn.r ? undefined : true}
            data-testid="panel-r"
          >
            <div
              className="e7 editor-inspector scroll-thin h-full overflow-y-auto overflow-x-hidden"
              data-testid="inspector"
              data-scrollport="inspector"
            >
              <PanelSlot slot={right} collapse={closeR} />
            </div>
          </div>
        </div>
        {overlay}
      </div>
    </div>
  )
}

type PanelSlotContent = ReactNode | ((collapse: () => void) => ReactNode)

function PanelSlot({
  slot,
  collapse,
}: {
  slot: PanelSlotContent
  collapse: () => void
}) {
  return typeof slot === 'function' ? slot(collapse) : slot
}

export function PanelToggles({
  panels,
  onToggle,
}: {
  panels: EditorPanels
  onToggle: (key: keyof EditorPanels) => void
}) {
  const tg = (
    k: keyof EditorPanels,
    name: string,
    key: string,
    icon: 'panelLeft' | 'panelBottom' | 'panelRight',
  ) => {
    const on = panels[k]
    return (
      <button
        key={k}
        type="button"
        className="e7-ghost e7-tip e7-tog grid size-8 place-items-center rounded-md p-0"
        style={{ color: SUB }}
        aria-expanded={on}
        aria-label={`${on ? 'Hide' : 'Show'} ${name}`}
        data-testid={`toggle-${k}`}
        data-panel-toggle={k}
        onClick={() => {
          onToggle(k)
        }}
      >
        <Icon name={icon} size={16} />
        <span className="e7-tt" aria-hidden>
          {on ? 'Hide' : 'Show'} {name}
          <kbd>{key}</kbd>
        </span>
      </button>
    )
  }
  return (
    <div
      className="ml-1 flex items-center gap-0.5"
      role="group"
      aria-label="Panels"
    >
      {tg('l', 'spreads', '[', 'panelLeft')}
      {tg('b', 'photos', '\\', 'panelBottom')}
      {tg('r', 'inspector', ']', 'panelRight')}
    </div>
  )
}

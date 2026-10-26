import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { DEFAULT_EDITOR_PANELS, type EditorPanels } from './editorChromePanels'
import { ensureEditorChromeStyles } from './editorChromeTokens'
import { installEditorChromeKeys } from './installEditorChromeKeys'

export type { EditorPanels } from './editorChromePanels'

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
  right: ReactNode
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

  useEffect(() => {
    return installEditorChromeKeys({
      getPanels: () => pnRef.current,
      setPanels: setPn,
      setSpaceDown,
    })
  }, [setPn])

  return (
    <div
      className={['e7', 'editor-shell', className].filter(Boolean).join(' ')}
      data-testid="editor-shell"
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
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="e7-canvas editor-workspace relative flex min-h-0 flex-1 flex-col overflow-hidden"
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
              {right}
            </div>
          </div>
        </div>
        {overlay}
      </div>
    </div>
  )
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
        className="e7-ghost e7-tip e7-tog grid size-8 place-items-center rounded-md"
        aria-pressed={on}
        aria-label={`${on ? 'Hide' : 'Show'} ${name}`}
        data-testid={`toggle-${k}`}
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

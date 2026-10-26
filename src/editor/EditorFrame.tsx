// Stryker disable all: kit chrome layout JSX; panel/hotkey logic covered in editorChromePanels unit tests + region testids
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import {
  DEFAULT_EDITOR_PANELS,
  isPanelToggleChord,
  isSpacePanCode,
  panelHotkeyAction,
  toggleAllEditorPanels,
  toggleEditorPanel,
  type EditorPanels,
} from './editorChromePanels'
import {
  BAR,
  ensureEditorChromeStyles,
  SURROUND,
  T,
} from './editorChromeTokens'

export type { EditorPanels } from './editorChromePanels'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('textarea,[contenteditable=true]')) return true
  const input = el.closest('input')
  if (!(input instanceof HTMLInputElement)) return false
  return ![
    'file',
    'checkbox',
    'radio',
    'range',
    'button',
    'submit',
    'color',
  ].includes(input.type)
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
  left?: ReactNode
  right?: ReactNode
  dock?: ReactNode
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

  const toggleAll = useCallback(() => {
    setPn(toggleAllEditorPanels(pnRef.current))
  }, [setPn])

  const tabbed = useRef(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const spaceDownRef = useRef(false)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!isSpacePanCode(e.code) || isTypingTarget(e.target)) return
      if (e.type === 'keydown') {
        e.preventDefault()
        e.stopPropagation()
        spaceDownRef.current = true
        setSpaceDown(true)
      } else {
        spaceDownRef.current = false
        setSpaceDown(false)
      }
    }
    const clear = () => {
      spaceDownRef.current = false
      setSpaceDown(false)
    }
    window.addEventListener('keydown', on, true)
    window.addEventListener('keyup', on, true)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', on, true)
      window.removeEventListener('keyup', on, true)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (spaceDownRef.current || isSpacePanCode(e.code)) return
      const el = e.target instanceof HTMLElement ? e.target : null
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (isPanelToggleChord(mod, e.key)) {
        e.preventDefault()
        toggleAll()
        return
      }
      if (mod || e.altKey) return
      if (el?.closest('input')) return
      const action = panelHotkeyAction(e.key, {
        left: !!left,
        bottom: !!dock,
        right: !!right,
      })
      if (action.kind === 'toggle') {
        e.preventDefault()
        setPn(toggleEditorPanel(pnRef.current, action.key))
      }
    }
    window.addEventListener('keydown', on)
    return () => {
      window.removeEventListener('keydown', on)
    }
  }, [left, right, dock, setPn, toggleAll])

  const showL = !!left && pn.l
  const showB = !!dock && pn.b
  const showR = !!right && pn.r

  return (
    <div
      className={[
        'e7',
        'editor-shell',
        'relative',
        'flex',
        'h-full',
        'flex-col',
        'overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: SURROUND, color: T }}
      data-testid="editor-shell"
    >
      <div
        className="relative flex h-full min-h-0 flex-col"
        data-testid="editor"
      >
        {top}
        <div className="flex min-h-0 flex-1">
          {left ? (
            <div
              className="e7-pan shrink-0 overflow-hidden"
              style={{ width: showL ? 212 : 0 }}
              aria-hidden={!showL || undefined}
              inert={!showL || undefined}
              data-hidden-panel={!showL || undefined}
              data-testid="panel-l"
            >
              <div className="h-full w-full" style={{ width: 212 }}>
                {left}
              </div>
            </div>
          ) : null}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="e7-canvas editor-workspace relative flex min-h-0 flex-1 flex-col overflow-hidden"
              data-testid="canvas"
              data-workspace="editor-workspace"
              tabIndex={0}
              aria-label="Canvas"
              data-panning={spaceDown || undefined}
              onFocus={(e) => {
                if (e.target === e.currentTarget) tabbed.current = false
              }}
              onKeyDown={(e) => {
                if (spaceDownRef.current || isSpacePanCode(e.code)) return
                if (
                  e.key !== 'Tab' ||
                  e.target !== e.currentTarget ||
                  e.shiftKey ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.altKey ||
                  tabbed.current
                ) {
                  return
                }
                tabbed.current = true
                e.preventDefault()
                toggleAll()
              }}
            >
              <div
                className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                data-testid="editor-workspace"
                style={{ background: SURROUND }}
              >
                {canvas}
              </div>
            </div>
            {dock ? (
              <div
                className="e7-pan shrink-0 overflow-hidden"
                style={{ height: showB ? undefined : 0 }}
                aria-hidden={!showB || undefined}
                inert={!showB || undefined}
                data-hidden-panel={!showB || undefined}
                data-testid="panel-b"
              >
                {dock}
              </div>
            ) : null}
          </main>
          {right ? (
            <div
              className="e7-pan shrink-0 overflow-hidden"
              style={{ width: showR ? 300 : 0 }}
              aria-hidden={!showR || undefined}
              inert={!showR || undefined}
              data-hidden-panel={!showR || undefined}
              data-testid="panel-r"
            >
              <div
                className="e7 scroll-thin h-full overflow-y-auto overflow-x-hidden"
                style={{ width: 300, background: BAR }}
                data-testid="inspector"
                data-scrollport="inspector"
              >
                {right}
              </div>
            </div>
          ) : null}
        </div>
        {overlay}
      </div>
    </div>
  )
}

export function PanelToggles({
  panels,
  onToggle,
  hasLeft,
  hasBottom,
  hasRight,
}: {
  panels: EditorPanels
  onToggle: (key: keyof EditorPanels) => void
  hasLeft?: boolean
  hasBottom?: boolean
  hasRight?: boolean
}) {
  const tg = (
    k: keyof EditorPanels,
    name: string,
    key: string,
    icon: 'panelLeft' | 'panelBottom' | 'panelRight',
    show: boolean,
  ) => {
    if (!show) return null
    const on = panels[k]
    return (
      <button
        key={k}
        type="button"
        className="e7-ghost e7-tip e7-tog grid size-8 place-items-center rounded-md"
        style={{ color: '#535152' }}
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
      {tg('l', 'spreads', '[', 'panelLeft', !!hasLeft)}
      {tg('b', 'photos', '\\', 'panelBottom', !!hasBottom)}
      {tg('r', 'inspector', ']', 'panelRight', !!hasRight)}
    </div>
  )
}

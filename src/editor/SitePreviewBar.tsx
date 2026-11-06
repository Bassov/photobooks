import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { takeFocus, trapTab } from '../lib/focusTrap'
import { Icon } from '../ui/Icon'
import { ChromeButton } from './ChromeButton'
import { BAR, SUB } from './editorChromeTokens'
import { suspendEditorKeys } from './editorKeysGate'
import { sitePreviewKey } from './sitePreviewKeys'

const noSlide = (): void => undefined

/**
 * Site preview root (above all editor chrome) and its 48 px app bar: Back
 * sits exactly on the top bar's "‹ Library" link, then the "Site preview"
 * label. It owns the keyboard from the first frame: eager, so the lazy page's
 * Suspense fallback (no slides yet) already keeps every key from the editor.
 */
export function SitePreviewFrame({
  onExit,
  slide = 0,
  n = 0,
  onSlide = noSlide,
  children,
}: {
  onExit: () => void
  /** Current slide of `0..n` (cover + `n` spreads). */
  slide?: number
  n?: number
  onSlide?: (slide: number) => void
  children?: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const keys = useRef({ slide, n, onSlide, onExit })
  useLayoutEffect(() => {
    keys.current = { slide, n, onSlide, onExit }
  })
  useEffect(() => {
    const resume = suspendEditorKeys()
    const restoreFocus = takeFocus(rootRef.current)
    // Document capture: the lightbox's window-capture listener runs first and
    // stops what it handles; every other key stops here, before the editor.
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation()
      const current = keys.current
      const action = sitePreviewKey(
        event.key,
        {
          alt: event.altKey,
          ctrl: event.ctrlKey,
          meta: event.metaKey,
          shift: event.shiftKey,
        },
        current.slide,
        current.n,
      )
      if (action === null) return
      if (action.kind === 'close') {
        current.onExit()
        return
      }
      event.preventDefault()
      if (action.kind === 'tab') {
        trapTab(rootRef.current, action.back)
        return
      }
      current.onSlide(action.slide)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      resume()
      restoreFocus()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-80 flex flex-col outline-none"
      style={{ background: BAR }}
      role="dialog"
      aria-modal="true"
      aria-label="Site preview"
      tabIndex={-1}
      data-testid="site-preview"
    >
      <div
        className="flex h-12 shrink-0 items-center gap-2 px-3"
        style={{ background: BAR, boxShadow: 'inset 0 -1px 0 var(--border)' }}
        data-testid="site-preview-bar"
      >
        <ChromeButton
          className="h-8 shrink-0 text-sm"
          style={{ color: SUB, gap: 4, paddingLeft: 6, paddingRight: 10 }}
          data-testid="site-preview-back"
          title="Back to the editor (Esc)"
          aria-keyshortcuts="Escape"
          onClick={onExit}
        >
          <Icon name="chevronLeft" size={16} />
          Back to the editor
        </ChromeButton>
        <span
          className="text-sm"
          style={{ color: SUB }}
          data-testid="site-preview-label"
        >
          Site preview
        </span>
      </div>
      {children}
    </div>
  )
}

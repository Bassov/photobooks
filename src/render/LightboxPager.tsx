import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { takeFocus, trapTab } from '../lib/focusTrap'
import { Icon } from '../ui/Icon'
import { useHoverPointer } from './hoverPointer'
import { stepIndex } from './pagerIndex'
import {
  fitArea,
  fitBox,
  fitInsets,
  ZOOM_STEP,
  ZOOM_TOGGLE,
  type Rect,
  type Size,
} from './pagerZoom'
import { useLightboxZoom } from './useLightboxZoom'

/** The dialog's size and each mounted slide's natural (unzoomed) size. */
interface Measured {
  key: string
  view: Size
  sizes: Readonly<Record<number, Size>>
}

const UNMEASURED: Measured = { key: '', view: { w: 0, h: 0 }, sizes: {} }

const CHIP =
  'absolute grid cursor-pointer place-items-center rounded-full border-0 bg-(--presentation-chip) p-0 text-(--presentation-chip-ink) outline-none transition-colors duration-[120ms] hover:bg-(--presentation-chip-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white focus-visible:outline-solid'

/** Controls never start a swipe or a pan. */
const stopDown = (e: ReactPointerEvent) => {
  e.stopPropagation()
}

/**
 * Site lightbox variant of the pager (Designer site-lightbox §2–§3): each
 * slide fits the viewport minus the control insets (CSS `zoom` from its
 * measured natural size) and zooms 1–3× on a transform-only layer.
 */
export function LightboxPager({
  count,
  index,
  onIndexChange,
  onExit,
  renderSpread,
  position,
  ariaLabel,
  testId,
  onZoomSettle,
}: {
  count: number
  index: number
  onIndexChange: (next: number) => void
  onExit: () => void
  renderSpread: (index: number) => ReactNode
  position: (index: number, count: number) => string
  ariaLabel: string
  testId: string
  onZoomSettle: ((z: number, width: number) => void) | undefined
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hover = useHoverPointer()
  const [{ view, sizes }, setMeasured] = useState(UNMEASURED)
  const insets = fitInsets(hover)
  const area = fitArea(view, insets)
  const boxOf = (k: number): Rect => {
    const size = sizes[k]
    return size === undefined ? area : fitBox(size, view, insets)
  }
  const box = boxOf(index)

  const jump = (to: number) => {
    if (to !== index) onIndexChange(to)
  }
  const go = (delta: number) => {
    jump(stepIndex(index, delta, count))
  }
  const zoom = useLightboxZoom({ rootRef, index, box, area, onStep: go })
  const { zoomBy, reset } = zoom

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Space on a focused control presses it.
    const onButton =
      e.target instanceof Element && e.target.closest('button') !== null
    const next = () => {
      go(1)
    }
    const actions: Partial<Record<string, () => void>> = {
      Tab: () => {
        trapTab(rootRef.current, e.shiftKey)
      },
      Escape: onExit,
      ArrowRight: next,
      ' ': onButton ? undefined : next,
      ArrowLeft: () => {
        go(-1)
      },
      Home: () => {
        jump(0)
      },
      End: () => {
        jump(Math.max(0, count - 1))
      },
      '+': () => {
        zoomBy(ZOOM_STEP)
      },
      '=': () => {
        zoomBy(ZOOM_STEP)
      },
      '-': () => {
        zoomBy(1 / ZOOM_STEP)
      },
      '0': reset,
    }
    const action = actions[e.key]
    if (action === undefined) return
    e.preventDefault()
    e.stopPropagation()
    action()
  }
  const keys = useRef(onKey)
  useLayoutEffect(() => {
    keys.current = onKey
  })

  useEffect(() => {
    // Modal: the dialog takes focus (not the X: no ring on a mouse open),
    // keys are handled before the page's, focus goes back on close.
    const restoreFocus = takeFocus(rootRef.current)
    const listener = (e: KeyboardEvent) => {
      keys.current(e)
    }
    window.addEventListener('keydown', listener, true)
    return () => {
      window.removeEventListener('keydown', listener, true)
      restoreFocus()
    }
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const naturals = root.querySelectorAll<HTMLElement>('[data-pager-natural]')
    const measure = () => {
      const measured: Record<number, Size> = {}
      for (const el of naturals) {
        // A slide not laid out yet keeps the fit area.
        if (el.offsetWidth > 0) {
          measured[Number(el.dataset.pagerNatural)] = {
            w: el.offsetWidth,
            h: el.offsetHeight,
          }
        }
      }
      const next = {
        view: { w: root.clientWidth, h: root.clientHeight },
        sizes: measured,
      }
      const key = JSON.stringify(next)
      setMeasured((prev) => (prev.key === key ? prev : { key, ...next }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const el of naturals) observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [index, count])

  // Photos are sized for the settled zoom (not per wheel frame).
  const fitted = sizes[index] === undefined ? undefined : box.w
  const z = zoom.zoom.z
  useEffect(() => {
    if (!zoom.live && fitted !== undefined) onZoomSettle?.(z, fitted)
  }, [zoom.live, z, fitted, onZoomSettle])

  const visible = [index - 1, index, index + 1].filter(
    (i) => i >= 0 && i < count,
  )
  const arrowTop = area.y + area.h / 2 - 20
  const cursor = z > 1 ? (zoom.dragging ? 'grabbing' : 'grab') : 'default'
  const first = index === 0
  const last = index >= count - 1

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-60 touch-none overflow-hidden bg-(--presentation) text-(--presentation-ink) outline-none select-none"
      style={{ cursor }}
      data-testid={testId}
      data-zoom={z.toFixed(2)}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      {...zoom.handlers}
    >
      {visible.map((k) => {
        const active = k === index
        const size = sizes[k]
        const b = boxOf(k)
        const kz = zoom.zoomOf(k)
        return (
          <div
            key={k}
            className="absolute transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
            data-testid="lightbox-slide"
            data-active={active ? 'true' : 'false'}
            aria-hidden={active ? undefined : true}
            inert={active ? undefined : true}
            style={{
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              transform: `translateX(${String((k - index) * 100)}%)`,
            }}
          >
            <div
              className={
                active && zoom.anim
                  ? 'size-full origin-top-left transition-transform duration-200 ease-out motion-reduce:transition-none'
                  : 'size-full origin-top-left'
              }
              data-testid={active ? 'site-fullscreen-layer' : undefined}
              style={{
                transform: `translate(${String(kz.x)}px, ${String(kz.y)}px) scale(${String(kz.z)})`,
                willChange: active && zoom.live ? 'transform' : undefined,
              }}
            >
              <div
                className="w-max"
                data-pager-natural={k}
                data-testid={active ? 'site-fullscreen-book' : undefined}
                style={{ zoom: size === undefined ? 1 : b.w / size.w }}
              >
                {renderSpread(k)}
              </div>
            </div>
          </div>
        )
      })}
      {hover && (
        <>
          <button
            type="button"
            className={`${CHIP} size-10`}
            data-pager-control
            aria-label="Previous spread"
            inert={first ? true : undefined}
            style={{
              left: 12,
              top: arrowTop,
              visibility: first ? 'hidden' : undefined,
            }}
            onPointerDown={stopDown}
            onClick={() => {
              go(-1)
            }}
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            type="button"
            className={`${CHIP} size-10`}
            data-pager-control
            aria-label="Next spread"
            inert={last ? true : undefined}
            style={{
              right: 12,
              top: arrowTop,
              visibility: last ? 'hidden' : undefined,
            }}
            onPointerDown={stopDown}
            onClick={() => {
              go(1)
            }}
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </>
      )}
      <button
        type="button"
        className={`${CHIP} top-4 right-14 size-8`}
        data-pager-control
        data-testid="site-fullscreen-zoom"
        aria-label={z > 1 ? 'Zoom out' : 'Zoom in'}
        onPointerDown={stopDown}
        onClick={() => {
          if (z > 1) reset()
          else zoomBy(ZOOM_TOGGLE)
        }}
      >
        <Icon name={z > 1 ? 'zoomOut' : 'zoomIn'} />
      </button>
      <button
        type="button"
        className={`${CHIP} top-4 right-4 size-8`}
        data-pager-control
        data-testid="site-fullscreen-close"
        aria-label="Exit fullscreen"
        title="Close (Esc)"
        onPointerDown={stopDown}
        onClick={onExit}
      >
        <Icon name="x" />
      </button>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs leading-4 tabular-nums"
        aria-live="polite"
        data-testid="site-fullscreen-indicator"
      >
        {count === 0 ? '' : position(index, count)}
      </div>
    </div>
  )
}

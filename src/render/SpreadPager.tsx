import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { halfDelta, stepIndex, swipeDelta } from './pagerIndex'
import './SpreadPager.css'

/**
 * Fullscreen one-spread-at-a-time pager (presentation mode; reusable by a
 * site lightbox). Neighbours stay mounted at opacity 0 so their images are
 * requested and decoded before a flip; slides move with transform / opacity.
 */
export function SpreadPager({
  count,
  index,
  onIndexChange,
  onExit,
  renderSpread,
}: {
  count: number
  index: number
  onIndexChange: (next: number) => void
  onExit: () => void
  renderSpread: (index: number) => ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const swipeStart = useRef<number | null>(null)
  const swiped = useRef(false)
  const live = useRef({ index, count, onIndexChange, onExit })
  useEffect(() => {
    live.current = { index, count, onIndexChange, onExit }
  })

  const go = (delta: number) => {
    const { index: i, count: n, onIndexChange: change } = live.current
    const next = stepIndex(i, delta, n)
    if (next !== i) {
      change(next)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let delta = 0
      if (e.key === 'ArrowRight' || e.key === ' ') {
        delta = 1
      } else if (e.key === 'ArrowLeft') {
        delta = -1
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        live.current.onExit()
        return
      } else {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      go(delta)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const fit = fitRef.current
    if (stage === null || fit === null) {
      return
    }
    const measure = () => {
      const w = fit.offsetWidth
      const h = fit.offsetHeight
      if (w === 0 || h === 0) {
        return
      }
      // Leave room for the position line under the spread.
      setScale(
        Math.min(
          (stage.clientWidth * 0.94) / w,
          ((stage.clientHeight - 64) * 0.96) / h,
        ),
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(fit)
    return () => {
      observer.disconnect()
    }
  }, [index])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = e.clientX
    swiped.current = false
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (start === null) {
      return
    }
    const delta = swipeDelta(start, e.clientX)
    if (delta !== 0) {
      swiped.current = true
      go(delta)
    }
  }

  const visible = [index - 1, index, index + 1].filter(
    (i) => i >= 0 && i < count,
  )

  return (
    <div
      ref={stageRef}
      className="spread-pager"
      data-testid="presentation"
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        if (swiped.current) {
          swiped.current = false
          return
        }
        const rect = e.currentTarget.getBoundingClientRect()
        go(halfDelta(e.clientX, rect.left, rect.width))
      }}
    >
      {visible.map((i) => {
        const active = i === index
        return (
          <div
            key={i}
            className="spread-pager-slide"
            data-testid="presentation-slide"
            data-active={active ? 'true' : 'false'}
            aria-hidden={active ? undefined : true}
            inert={active ? undefined : true}
            style={{ transform: `translateX(${String((i - index) * 100)}%)` }}
          >
            <div
              ref={active ? fitRef : undefined}
              className="spread-pager-fit"
              style={{ transform: `scale(${String(scale)})` }}
            >
              {renderSpread(i)}
            </div>
          </div>
        )
      })}
      <div className="spread-pager-bar">
        <span className="tabular-nums" data-testid="pager-position">
          {index + 1} / {count}
        </span>
      </div>
      <button
        type="button"
        className="spread-pager-exit"
        data-testid="presentation-exit"
        aria-label="Exit presentation"
        onClick={(e) => {
          e.stopPropagation()
          onExit()
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
        }}
      >
        Esc
      </button>
    </div>
  )
}

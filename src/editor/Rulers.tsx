import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { getCommittedCamera, subscribeCommitted } from './cameraStore'
import {
  RULER_PX,
  rulerGeometry,
  rulerTicks,
  type RulerAxis,
} from './rulersMath'
import { startGuideDrag } from './guideGesture'
import type { GuideOrientation } from './guidesMath'
import { drawRulerTicks } from './rulersPaint'
import './Rulers.css'

const ACTIVE_SPREAD =
  '[data-pasteboard-slot][data-active="true"] [data-testid="spread-view"]'

/** Active spread's on-screen box relative to the scroll area (null while nothing is mounted). */
function measure(scroll: HTMLElement, pageMm: number) {
  const spread =
    scroll.querySelector<HTMLElement>(ACTIVE_SPREAD) ??
    scroll.querySelector<HTMLElement>('[data-testid="spread-view"]')
  if (spread === null || spread.offsetWidth === 0) return null
  const box = spread.getBoundingClientRect()
  const area = scroll.getBoundingClientRect()
  return {
    spread,
    ...rulerGeometry({
      boxLeft: box.left,
      boxTop: box.top,
      boxWidth: box.width,
      areaLeft: area.left,
      areaTop: area.top,
      offsetWidth: spread.offsetWidth,
      pxPerMm: SPREAD_PX_PER_MM * getCommittedCamera().zoom,
      pageMm,
    }),
    lenX: scroll.clientWidth,
    lenY: scroll.clientHeight,
    areaLeft: area.left,
    areaTop: area.top,
  }
}

function paintAxis(
  canvas: HTMLCanvasElement,
  axis: RulerAxis,
  origin: number,
  sc: number,
  len: number,
  pageMm: number,
): void {
  const dpr = window.devicePixelRatio || 1
  const w = axis === 'x' ? len : RULER_PX
  const h = axis === 'x' ? RULER_PX : len
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  const style = getComputedStyle(canvas)
  ctx.scale(dpr, dpr)
  ctx.font = `${style.fontSize} ${style.fontFamily}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = style.color
  drawRulerTicks(
    ctx,
    axis,
    rulerTicks({ axis, origin, sc, len, pageMm }),
    style.color,
  )
}

/** Kit mm rulers over the pasteboard; repaints from scroll / camera / resize, never per React render. */
export function Rulers({
  scrollRef,
  pageMm,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  pageMm: number
}) {
  const rulerX = useRef<HTMLDivElement>(null)
  const rulerY = useRef<HTMLDivElement>(null)
  const canvasX = useRef<HTMLCanvasElement>(null)
  const canvasY = useRef<HTMLCanvasElement>(null)
  const spine = useRef<HTMLSpanElement>(null)
  const cursorX = useRef<HTMLSpanElement>(null)
  const cursorY = useRef<HTMLSpanElement>(null)
  const activeSpread = useRef<HTMLElement | null>(null)

  // Pulling from the top strip makes a horizontal guide, from the left strip a vertical one.
  const pull = (
    e: ReactPointerEvent<HTMLDivElement>,
    orientation: GuideOrientation,
  ): void => {
    const spreadEl = activeSpread.current
    if (e.button !== 0 || spreadEl === null) return
    e.preventDefault()
    startGuideDrag({
      event: e.nativeEvent,
      spreadEl,
      orientation,
      rulerEl: e.currentTarget,
    })
  }

  useEffect(() => {
    const scroll = scrollRef.current
    const stage = scroll?.parentElement
    if (!scroll || !stage) return
    let raf = 0
    let area = { left: 0, top: 0 }
    // The spread's own size changes when the zoom commits (after our camera tick).
    const resize = new ResizeObserver(() => {
      schedule()
    })
    let observed: HTMLElement | null = null
    const paint = (): void => {
      raf = 0
      const g = measure(scroll, pageMm)
      activeSpread.current = g?.spread ?? null
      if (g === null) return
      if (g.spread !== observed) {
        if (observed) resize.unobserve(observed)
        resize.observe(g.spread)
        observed = g.spread
      }
      area = { left: g.areaLeft, top: g.areaTop }
      if (rulerX.current) rulerX.current.dataset.origin = String(g.originX)
      if (rulerY.current) rulerY.current.dataset.origin = String(g.originY)
      if (canvasX.current)
        paintAxis(canvasX.current, 'x', g.originX, g.sc, g.lenX, pageMm)
      if (canvasY.current)
        paintAxis(canvasY.current, 'y', g.originY, g.sc, g.lenY, pageMm)
      if (spine.current) {
        spine.current.hidden = g.spineMm === null
        spine.current.style.left = `${String(g.originX + (g.spineMm ?? 0) * g.sc)}px`
      }
    }
    const schedule = (): void => {
      if (raf === 0) raf = requestAnimationFrame(paint)
    }
    const onMove = (e: PointerEvent): void => {
      if (cursorX.current) {
        cursorX.current.hidden = false
        cursorX.current.style.left = `${String(e.clientX - area.left)}px`
      }
      if (cursorY.current) {
        cursorY.current.hidden = false
        cursorY.current.style.top = `${String(e.clientY - area.top)}px`
      }
    }
    const onLeave = (): void => {
      if (cursorX.current) cursorX.current.hidden = true
      if (cursorY.current) cursorY.current.hidden = true
    }
    paint()
    scroll.addEventListener('scroll', schedule, { passive: true })
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerleave', onLeave)
    const offCamera = subscribeCommitted(schedule)
    resize.observe(scroll)
    // The world re-sizes (and re-centres the spread) a frame after the scroll area is inset.
    if (scroll.firstElementChild) resize.observe(scroll.firstElementChild)
    const mutations = new MutationObserver(schedule)
    mutations.observe(scroll, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active'],
    })
    return () => {
      cancelAnimationFrame(raf)
      scroll.removeEventListener('scroll', schedule)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      offCamera()
      resize.disconnect()
      mutations.disconnect()
    }
  }, [scrollRef, pageMm])

  return (
    <>
      <div
        ref={rulerX}
        className="ruler ruler-x"
        data-testid="ruler-x"
        aria-hidden="true"
        onPointerDown={(e) => {
          pull(e, 'horizontal')
        }}
      >
        <canvas ref={canvasX} />
        <span ref={spine} className="ruler-spine" hidden />
        <span ref={cursorX} className="ruler-cursor ruler-cursor-x" hidden />
      </div>
      <div
        ref={rulerY}
        className="ruler ruler-y"
        data-testid="ruler-y"
        aria-hidden="true"
        onPointerDown={(e) => {
          pull(e, 'vertical')
        }}
      >
        <canvas ref={canvasY} />
        <span ref={cursorY} className="ruler-cursor ruler-cursor-y" hidden />
      </div>
      <div
        className="ruler-corner"
        data-testid="ruler-corner"
        aria-hidden="true"
      >
        mm
      </div>
    </>
  )
}

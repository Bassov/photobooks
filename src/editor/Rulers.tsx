import { useEffect, useRef, type RefObject } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { getCommittedCamera, subscribeCommitted } from './cameraStore'
import {
  RULER_PX,
  rulerGeometry,
  rulerTicks,
  type RulerAxis,
} from './rulersMath'
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
  const canvasX = useRef<HTMLCanvasElement>(null)
  const canvasY = useRef<HTMLCanvasElement>(null)
  const spine = useRef<HTMLSpanElement>(null)
  const cursorX = useRef<HTMLSpanElement>(null)
  const cursorY = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const scroll = scrollRef.current
    const stage = scroll?.parentElement
    if (!scroll || !stage) return
    let raf = 0
    let area = { left: 0, top: 0 }
    const paint = (): void => {
      raf = 0
      const g = measure(scroll, pageMm)
      if (g === null) return
      area = { left: g.areaLeft, top: g.areaTop }
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
    const resize = new ResizeObserver(schedule)
    resize.observe(scroll)
    const mutations = new MutationObserver(schedule)
    mutations.observe(scroll, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active', 'style'],
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
      <div className="ruler ruler-x" data-testid="ruler-x" aria-hidden="true">
        <canvas ref={canvasX} />
        <span ref={spine} className="ruler-spine" hidden />
        <span ref={cursorX} className="ruler-cursor ruler-cursor-x" hidden />
      </div>
      <div className="ruler ruler-y" data-testid="ruler-y" aria-hidden="true">
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

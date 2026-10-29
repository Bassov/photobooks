import { RULER_PX, type RulerAxis, type RulerTick } from './rulersMath'

const MINOR_PX = 4
const MAJOR_PX = 9

export type RulerContext = Pick<
  CanvasRenderingContext2D,
  | 'fillRect'
  | 'fillText'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'measureText'
  | 'globalAlpha'
  | 'fillStyle'
>

/** Kit tick look: 1 px ticks at 50% (X anchored bottom, Y right), labels on majors, Y labels read bottom-to-top. */
export function drawRulerTicks(
  ctx: RulerContext,
  axis: RulerAxis,
  ticks: readonly RulerTick[],
  color: string,
): void {
  for (const tick of ticks) {
    const size = tick.major ? MAJOR_PX : MINOR_PX
    const p = Math.floor(tick.p)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = color
    if (axis === 'x') ctx.fillRect(p, RULER_PX - size, 1, size)
    else ctx.fillRect(RULER_PX - size, p, size, 1)
    if (tick.label === undefined) continue
    ctx.globalAlpha = 1
    const text = String(tick.label)
    if (axis === 'x') {
      ctx.fillText(text, tick.p + 2, 1)
      continue
    }
    ctx.save()
    ctx.translate(2, tick.p + 2 + ctx.measureText(text).width)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

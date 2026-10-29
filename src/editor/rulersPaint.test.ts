import { describe, expect, it } from 'vitest'
import { drawRulerTicks, type RulerContext } from './rulersPaint'

function recorder(textWidth = 7) {
  const calls: string[] = []
  let alpha = 1
  const alphas: number[] = []
  const ctx = {
    get globalAlpha() {
      return alpha
    },
    set globalAlpha(v: number) {
      alpha = v
    },
    fillStyle: '',
    fillRect: (...a: number[]) => {
      alphas.push(alpha)
      calls.push(`rect ${a.join(',')}`)
    },
    fillText: (...a: (string | number)[]) => {
      alphas.push(alpha)
      calls.push(`text ${a.join(',')}`)
    },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: (...a: number[]) => calls.push(`translate ${a.join(',')}`),
    rotate: (a: number) => calls.push(`rotate ${String(a)}`),
    measureText: () => ({ width: textWidth }),
  }
  return { calls, alphas, ctx: ctx as unknown as RulerContext }
}

describe('drawRulerTicks', () => {
  it('draws X ticks anchored at the bottom: minors 4 px, majors 9 px, labels beside majors', () => {
    const { calls, alphas, ctx } = recorder()
    drawRulerTicks(
      ctx,
      'x',
      [
        { mm: 0, p: 10.7, major: true, label: 0 },
        { mm: 2, p: 20.2, major: false },
      ],
      'red',
    )
    expect(calls).toEqual(['rect 10,13,1,9', 'text 0,12.7,1', 'rect 20,18,1,4'])
    expect(alphas).toEqual([0.5, 1, 0.5])
    expect(ctx.fillStyle).toBe('red')
    expect(ctx.globalAlpha).toBe(1)
  })

  it('draws Y ticks anchored right and rotates the label above its tick', () => {
    const { calls, ctx } = recorder(7)
    drawRulerTicks(
      ctx,
      'y',
      [
        { mm: 10, p: 30, major: true, label: 10 },
        { mm: 12, p: 40, major: false },
      ],
      'blue',
    )
    expect(calls).toEqual([
      'rect 13,30,9,1',
      'save',
      'translate 2,39',
      `rotate ${String(-Math.PI / 2)}`,
      'text 10,0,0',
      'restore',
      'rect 18,40,4,1',
    ])
  })

  it('draws nothing for no ticks', () => {
    const { calls, ctx } = recorder()
    drawRulerTicks(ctx, 'x', [], 'red')
    expect(calls).toEqual([])
  })
})

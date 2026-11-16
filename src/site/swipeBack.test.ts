import { describe, expect, it } from 'vitest'
import {
  paintSwipe,
  swipeMove,
  swipeShuts,
  swipeStart,
  type Swipe,
} from './swipeBack'

const start = swipeStart(1, 10, 100)
const active = (dx: number, trail: Swipe['trail'] = []): Swipe => ({
  ...start,
  active: true,
  dx,
  trail,
})

describe('swipeStart', () => {
  it('tracks a press that does not follow yet', () => {
    expect(start).toStrictEqual({
      id: 1,
      x0: 10,
      y0: 100,
      active: false,
      dx: 0,
      trail: [],
    })
  })
})

describe('swipeMove', () => {
  it('follows once dx > 10 and dx > 1.5·|dy|', () => {
    expect(swipeMove(start, 21, 100, 5)).toStrictEqual(active(11, [[5, 11]]))
    expect(swipeMove(start, 26, 110, 5)).toStrictEqual(active(16, [[5, 16]]))
  })

  it.each([
    ['dx = 10', 20, 100],
    ['dx = 1.5·|dy|', 25, 110],
    ['dx = −10', 0, 100],
  ])('waits at %s', (_, x, y) => {
    expect(swipeMove(start, x, y, 5)).toBe(start)
  })

  it.each([
    ['|dy| > 10', 30, 111],
    ['|dy| > 10 upwards', 30, 89],
    ['dx < −10', -1, 100],
  ])('abandons at %s', (_, x, y) => {
    expect(swipeMove(start, x, y, 5)).toBeNull()
  })

  it('once following, any vertical drift follows and a leftward drag pins 0', () => {
    expect(swipeMove(active(15), 30, 150, 5)?.dx).toBe(20)
    expect(swipeMove(active(15), 5, 100, 5)?.dx).toBe(0)
  })

  it('keeps the moves of the last 80 ms', () => {
    const g = active(10, [
      [0, 5],
      [20, 10],
    ])

    expect(swipeMove(g, 40, 100, 100)?.trail).toStrictEqual([
      [20, 10],
      [100, 30],
    ])
  })
})

describe('swipeShuts', () => {
  it('shuts past a quarter of the width', () => {
    expect(swipeShuts(active(101), 100, 400)).toBe(true)
    expect(swipeShuts(active(100), 100, 400)).toBe(false)
  })

  it.each([
    [
      '0.6 px/ms from the oldest move within 80 ms',
      60,
      [
        [0, 0],
        [50, 30],
        [100, 60],
      ],
      true,
    ],
    [
      '0.625 px/ms from a move exactly 80 ms back',
      50,
      [
        [20, 0],
        [100, 50],
      ],
      true,
    ],
    [
      '0.5 px/ms',
      50,
      [
        [20, 10],
        [100, 50],
      ],
      false,
    ],
    [
      'moves that share the release time',
      50,
      [
        [100, 20],
        [100, 50],
      ],
      false,
    ],
    ['no move within 80 ms', 50, [[10, 0]], false],
  ] as const)('flick: %s → %s', (_, dx, trail, shut) => {
    expect(swipeShuts(active(dx, trail), 100, 400)).toBe(shut)
  })
})

describe('paintSwipe', () => {
  it('follows the finger, slides, then rests', () => {
    const el = document.createElement('div')

    paintSwipe(el, 30, 0)
    expect(el.dataset.swipe).toBe('move')
    expect(el.style.transition).toBe('none')
    expect(el.style.transform).toBe('translate3d(30px,0,0)')
    expect(el.style.boxShadow).not.toBe('')

    paintSwipe(el, 0, 200)
    expect(el.dataset.swipe).toBe('move')
    expect(el.style.transition).toContain('transform 200ms')
    expect(el.style.transform).toBe('')
    expect(el.style.boxShadow).toBe('')

    paintSwipe(el, 0, 0)
    expect(el.dataset.swipe).toBe('')
    expect(el.style.transition).toBe('none')
  })
})

import { describe, expect, it } from 'vitest'
import {
  CSS_BODY,
  deskGeo,
  landGeo,
  lightboxSlide,
  pausesPlay,
  turnMs,
  wideDesk,
} from './roomModel'

describe('landGeo', () => {
  it.each([
    // [vw, vh, R, side, w, left, top]: side (vw − 272) vs foot (vw − 32) widths
    ['side, width-bound', 844, 390, 1.6, true, 572, 136, 16.25],
    ['side, height-bound', 1000, 400, 1.5, true, 564, 218, 12],
    ['foot, width-bound', 480, 470, 2, false, 448, 16, 99],
    ['foot, height-bound', 600, 450, 1.2, false, 463.2, 68.4, 8],
    ['side on a tie', 632, 424, 1, true, 360, 136, 32],
  ] as const)('%s', (_, vw, vh, R, side, w, left, top) => {
    const g = landGeo(vw, vh, R)

    expect(g.side).toBe(side)
    expect(g.reader.w).toBeCloseTo(w, 6)
    expect(g.reader.left).toBeCloseTo(left, 6)
    expect(g.reader.top).toBeCloseTo(top, 6)
    expect(g.rowTop).toBe(vh - 52)
  })
})

describe('wideDesk', () => {
  it('is wide past 640 px', () => {
    expect(wideDesk(640)).toBe(false)
    expect(wideDesk(641)).toBe(true)
  })
})

describe('deskGeo wide', () => {
  it('lays the CSS reader under the head and the foot row on the 12-column grid', () => {
    // col = (1424 − 48 − 176) / 12 = 100; the reader is (1424 − 128) wide
    const g = deskGeo(1424, 900, 2, CSS_BODY)

    expect(g).toStrictEqual({
      wide: true,
      margin: 24,
      reader: { w: 1296, left: 64, top: 121 },
      footTop: 846,
      about: { left: 24, width: 448 },
      pager: { left: 488, width: 448 },
      actions: { left: 1068, width: 332 },
      actionsTop: 846,
    })
  })

  it('centres the visible GL book of a short box in [44, h − 54]', () => {
    // height-bound: 738 · 1.5 / 0.9 = 1230; H 820, top 445 − 369 − 41
    const g = deskGeo(1424, 900, 1.5, [0.8, 0.9, 0.05, 0.01])

    expect(g.reader.w).toBeCloseTo(1230, 6)
    expect(g.reader.top).toBeCloseTo(35, 6)
    expect(g.reader.left).toBeCloseTo(84.7, 6)
  })

  it('keeps the visible GL book of a wide box 64 px off each side', () => {
    // width-bound: 1296 / 0.9 = 1440; H 576, top 445 − 230.4 − 57.6
    const g = deskGeo(1424, 900, 2.5, [0.9, 0.8, 0.1, 0])

    expect(g.reader.w).toBeCloseTo(1440, 6)
    expect(g.reader.top).toBeCloseTo(157, 6)
    expect(g.reader.left).toBeCloseTo(-8, 6)
  })

  it('never draws the reader under 200 px', () => {
    // col = (800 − 224) / 12 = 48
    const g = deskGeo(800, 500, 0.5, CSS_BODY)

    expect(g.reader).toStrictEqual({ w: 200, left: 300, top: 45 })
    expect(g.about).toStrictEqual({ left: 24, width: 240 })
    expect(g.pager).toStrictEqual({ left: 280, width: 240 })
    expect(g.actions).toStrictEqual({ left: 600, width: 176 })
  })
})

describe('deskGeo narrow', () => {
  it('fits the book four columns wide, the pager 24 under it, the actions 16 under that', () => {
    // col = (620 − 32 − 36) / 4 = 138, four columns 588
    const g = deskGeo(620, 560, 2, [0.8, 0.9, 0.05, 0.01])

    expect(g).toStrictEqual({
      wide: false,
      margin: 16,
      reader: { w: 588, left: 16, top: 113 },
      footTop: 431,
      about: null,
      pager: { left: 16, right: 16 },
      actions: { left: 16, right: 16 },
      actionsTop: 491,
    })
  })

  it('centres a height-bound book in [64, h − 104]', () => {
    const g = deskGeo(620, 400, 1.2, CSS_BODY)

    expect(g.reader.w).toBeCloseTo(278.4, 6)
    expect(g.reader.left).toBeCloseTo(170.8, 6)
    expect(g.reader.top).toBeCloseTo(64, 6)
    expect(g.footTop).toBeCloseTo(320, 6)
  })

  it('keeps 200 px when the box is too short', () => {
    const g = deskGeo(400, 300, 1, CSS_BODY)

    expect(g.reader).toStrictEqual({ w: 200, left: 100, top: 30 })
    expect(g.footTop).toBe(254)
  })
})

describe('turnMs', () => {
  it.each([
    [0, 1, 1000],
    [1, 0, 1000],
    [6, 7, 1000],
    [7, 6, 1000],
    [2, 3, 820],
    [3, 2, 820],
    [1, 3, 240],
    [3, 1, 240],
  ])('a turn from view %i to %i (back cover 7) runs %i ms', (a, z, ms) => {
    expect(turnMs(a, z, 7, false)).toBe(ms)
  })

  it('is 240 ms under reduced motion', () => {
    expect(turnMs(2, 3, 7, true)).toBe(240)
  })
})

describe('lightboxSlide', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [11, 10],
    [12, 10],
  ])('view %i opens spread %i of 11', (view, slide) => {
    expect(lightboxSlide(view, 11)).toBe(slide)
  })
})

describe('pausesPlay', () => {
  function dom() {
    document.body.innerHTML =
      '<button data-testid="site-play"><span>Play</span></button><button data-testid="other"></button>'
    const play = document.querySelector('[data-testid="site-play"] span')
    const other = document.querySelector('[data-testid="other"]')
    if (play === null || other === null) throw new Error('no buttons')
    return { play, other }
  }
  /** pausesPlay as seen while `e` is dispatched on `el` */
  function seen(el: EventTarget, e: Event): boolean {
    let paused: boolean | undefined
    el.addEventListener(e.type, (ev) => {
      paused = pausesPlay(ev)
    })
    el.dispatchEvent(e)
    if (paused === undefined) throw new Error('not dispatched')
    return paused
  }

  it.each([
    ['Enter', false],
    [' ', false],
    ['a', true],
  ])('Play pauses on its own key %j: %s', (k, paused) => {
    const { play } = dom()

    expect(seen(play, new KeyboardEvent('keydown', { key: k }))).toBe(paused)
  })

  it('a press on Play toggles it; a press or key elsewhere pauses', () => {
    const { play, other } = dom()

    expect(seen(play, new Event('pointerdown'))).toBe(false)
    expect(seen(other, new Event('pointerdown'))).toBe(true)
    expect(seen(other, new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(
      true,
    )
    expect(seen(window, new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(
      true,
    )
  })

  it('pauses on an event without a target', () => {
    expect(pausesPlay(new Event('pointerdown'))).toBe(true)
  })
})

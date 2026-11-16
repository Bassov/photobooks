import { describe, expect, it } from 'vitest'
import type { RoomSlide } from '../siteModel'
import { EASE, fromDrag, scripted, TURN } from './motion'
import {
  backingRatio,
  canvasPx,
  curlRadius,
  dragIntent,
  fadeOpacity,
  followBack,
  followFwd,
  grabPoint,
  landing,
  pushTrail,
  reducedCompletes,
  releaseCompletes,
  releaseVelocity,
  scriptAt,
  settleAt,
  settlePlan,
  sheetPaint,
  stepTurn,
  tapStep,
} from './turnGeo'

// a 300 × 400 sheet with a paper curl of r = 27: the turn ends at xm = −45, 345 px from the start
const PW = 300
const PH = 400
const R = 27

describe('the canvas', () => {
  it.each([
    [Number.NaN, 1],
    [0, 1],
    [0.5, 1],
    [1.5, 1.5],
    [2, 2],
    [3, 2],
  ])('backs a device ratio of %s with %s px per CSS px', (dpr, k) => {
    expect(backingRatio(dpr)).toBe(k)
  })

  it('sizes the backing to the stage width and the sheet with its overhangs', () => {
    expect(canvasPx(390, 500, 1.5)).toStrictEqual({ width: 585, height: 822 })
    expect(canvasPx(101, 101, 1.5)).toStrictEqual({ width: 152, height: 224 })
  })
})

describe('curlRadius', () => {
  const cover: RoomSlide = { view: 0, label: 'Cover' }
  const page: RoomSlide = {
    view: 1,
    label: 'Page 1',
    page: { spread: 0, side: 'right' },
  }

  it('curls the board cover wide and paper tight', () => {
    expect(curlRadius(cover, 300)).toBeCloseTo(90, 10)
    expect(curlRadius(page, 300)).toBeCloseTo(27, 10)
    expect(curlRadius(undefined, 300)).toBeCloseTo(90, 10)
  })
})

describe('sheetPaint', () => {
  it('paints nothing at rest', () => {
    expect(sheetPaint(PW, null, undefined)).toStrictEqual({
      xm: '',
      clip: '',
      opacity: '',
      fold: null,
    })
  })

  it('fades the top sheet by xm, unclipped and without a fold', () => {
    expect(sheetPaint(PW, 0.25, 'fade')).toStrictEqual({
      xm: '',
      clip: '',
      opacity: '0.25',
      fold: null,
    })
  })

  it('clips the top sheet at xm, a 28 px shadow right of it, the cut mirrored left of it', () => {
    expect(sheetPaint(PW, 250.04, 'fwd')).toStrictEqual({
      xm: '250.0',
      clip: `inset(0 ${String(PW - 250.04)}px 0 0)`,
      opacity: '',
      fold: {
        shadowLeft: 16 + 250.04,
        shadowWidth: 28,
        flapLeft: 16 + 2 * 250.04 - PW,
        flapWidth: PW - 250.04,
      },
    })
  })

  it('narrows the shadow to the cut near the edge and draws nothing past it', () => {
    expect(sheetPaint(PW, 290, 'back').fold?.shadowWidth).toBe(10)
    expect(sheetPaint(PW, 320, 'fwd')).toStrictEqual({
      xm: '320.0',
      clip: 'inset(0 0px 0 0)',
      opacity: '',
      fold: { shadowLeft: 336, shadowWidth: 0, flapLeft: 356, flapWidth: 0 },
    })
  })

  it('clips at most the whole sheet', () => {
    expect(sheetPaint(PW, -100, 'fwd').clip).toBe('inset(0 300px 0 0)')
    expect(sheetPaint(PW, -100, 'fwd').fold?.flapWidth).toBe(400)
  })
})

describe('the fade and the scripted turn', () => {
  it('fades the top sheet out along EASE', () => {
    expect(fadeOpacity(0)).toBeCloseTo(1, 12)
    expect(fadeOpacity(0.3)).toBeCloseTo(1 - EASE(0.3), 12)
    expect(fadeOpacity(1)).toBeCloseTo(0, 12)
  })

  it.each([
    [0, 1, 1, 2, { top: 0, under: 1, dir: 'fwd' }],
    [1, 1, 2, 3, { top: 1, under: 2, dir: 'fwd' }],
    [1, -1, 0, 3, { top: 0, under: 1, dir: 'back' }],
  ] as const)('turns from %s by %s onto %s of %s', (si, d, rest, n, turn) => {
    const t = stepTurn(si, d, n)

    expect(t).toStrictEqual(turn)
    expect(t && landing(t)).toBe(rest)
  })

  it('stays put past either end', () => {
    expect(stepTurn(2, 1, 3)).toBeNull()
    expect(stepTurn(0, -1, 3)).toBeNull()
  })

  it('lands a fade on the uncovered slide', () => {
    expect(landing({ top: 5, under: 0, dir: 'fade' })).toBe(0)
  })

  it('runs forward along TURN and backward along it reversed', () => {
    expect(scriptAt(PW, PH, R, 1, 0.3)).toStrictEqual(
      scripted(PW, PH, R, TURN(0.3)),
    )
    expect(scriptAt(PW, PH, R, -1, 0.3)).toStrictEqual(
      scripted(PW, PH, R, TURN(0.7)),
    )
    expect(scriptAt(PW, PH, R, -1, 0).xm).toBeCloseTo(-45, 10)
  })
})

describe('the gesture', () => {
  it.each([
    [0, 11, 'dead'],
    [0, -11, 'dead'],
    [-30, 10, 'fwd'],
    [0, 10, 'wait'],
    [-10, 0, 'wait'],
    [15, 10, 'wait'],
    [-11, 0, 'fwd'],
    [-16, 10, 'fwd'],
    [11, 0, 'back'],
    [11, 7, 'back'],
  ] as const)('reads a drag of (%s, %s) as %s', (dx, dy, intent) => {
    expect(dragIntent(dx, dy)).toBe(intent)
  })

  it.each([
    [7, -7, 350, 194, -1],
    [0, 0, 0, 195, 1],
    [8, 0, 10, 100, null],
    [-8, 0, 10, 100, null],
    [0, 8, 10, 100, null],
    [0, -8, 10, 100, null],
    [0, 0, 351, 100, null],
  ] as const)(
    'reads a release (%s, %s) after %s ms at x %s on 390 px as %s',
    (dx, dy, ms, x, step) => {
      expect(tapStep(dx, dy, ms, x, 390)).toBe(step)
    },
  )

  it.each([
    [99, { C: { x: PW, y: 0 }, corner: true }],
    [100, { C: { x: PW, y: 100 }, corner: false }],
    [300, { C: { x: PW, y: 300 }, corner: false }],
    [301, { C: { x: PW, y: PH }, corner: true }],
  ])('grabs at %s px from the top', (py, grab) => {
    expect(grabPoint(PW, PH, py)).toStrictEqual(grab)
  })
})

describe('the drag follow', () => {
  it('follows the corner or the edge it grabbed', () => {
    expect(followFwd(PW, PH, R, 390, -60, -10)).toStrictEqual(
      fromDrag(PW, PH, R, { x: PW, y: PH }, true, -60, -10),
    )
    expect(followFwd(PW, PH, R, 10, -60, 10)).toStrictEqual(
      fromDrag(PW, PH, R, { x: PW, y: 0 }, true, -60, 10),
    )
    expect(followFwd(PW, PH, R, 200, -50, 30).xm).toBeCloseTo(250, 10)
  })

  it('stops a forward drag with the curl off the screen', () => {
    expect(followFwd(PW, PH, R, 200, -1000, 0).xm).toBe(-45)
  })

  it('lays the sheet down over the stage right of the finger', () => {
    // stage 332: the finger at 16 has 300 px to its right edge (332 − 16)
    expect(followBack(PW, 332, R, 16, 100)).toBeCloseTo(-45 + 100 * 1.15, 10)
    // within 40 px of it: over 40 px
    expect(followBack(PW, 332, R, 290, 10)).toBeCloseTo(
      -45 + (10 * 345) / 40,
      10,
    )
  })

  it('keeps a backward drag within the turn', () => {
    expect(followBack(PW, 332, R, 16, -10)).toBe(-45)
    expect(followBack(PW, 332, R, 16, 400)).toBe(PW)
  })
})

describe('the release', () => {
  it('keeps the moves of the last 80 ms', () => {
    expect(
      pushTrail(
        [
          [0, 0],
          [50, -5],
        ],
        100,
        -20,
      ),
    ).toStrictEqual([
      [50, -5],
      [100, -20],
    ])
    expect(pushTrail([[0, 0]], 80, -3)).toStrictEqual([
      [0, 0],
      [80, -3],
    ])
  })

  it('measures px / ms over the trail, 0 for a finger that rested 80 ms', () => {
    const trail = [
      [10, 5],
      [60, -20],
    ] as const

    expect(releaseVelocity(trail, 70)).toBeCloseTo(-0.5, 12)
    expect(releaseVelocity(trail, 140)).toBeCloseTo(-0.5, 12)
    expect(releaseVelocity(trail, 141)).toBe(0)
    expect(releaseVelocity([[60, -20]], 70)).toBe(0)
    expect(releaseVelocity([], 70)).toBe(0)
  })

  it.each([
    ['fwd', 127, 0, true],
    ['fwd', 127.5, 0, false],
    ['fwd', PW, -0.31, true],
    ['fwd', PW, -0.3, false],
    ['fwd', PW, -4, true],
    ['fwd', 0, 0.3, true],
    ['fwd', 0, 0.31, false],
    ['back', 128, 0, true],
    ['back', 127.5, 0, false],
    ['back', -45, 0.31, true],
    ['back', -45, 4, true],
    ['back', PW, -0.31, false],
  ] as const)(
    'a %s turn released at xm %s at %s px/ms completes: %s',
    (dir, xm, v, done) => {
      expect(releaseCompletes(dir, xm, PW, R, v)).toBe(done)
    },
  )

  it.each([
    ['fwd', -41, true],
    ['fwd', -40, false],
    ['fwd', 50, false],
    ['back', 41, true],
    ['back', 40, false],
  ] as const)(
    'crossfades a reduced-motion %s drag of %s: %s',
    (dir, dx, done) => {
      expect(reducedCompletes(dir, dx)).toBe(done)
    },
  )

  it('runs a completed forward turn off the screen onto the next slide', () => {
    expect(
      settlePlan({ top: 0, under: 1, dir: 'fwd' }, true, 0, 100, PW, R),
    ).toStrictEqual({ to: -45, target: 1, ms: 160 + (440 * 145) / 345 })
  })

  it('springs a forward turn back onto the slide it left', () => {
    expect(
      settlePlan({ top: 0, under: 1, dir: 'fwd' }, false, 0, 100, PW, R),
    ).toStrictEqual({ to: PW, target: 0, ms: 160 + (440 * 200) / 345 })
  })

  it('lays a backward turn down, or lifts it off again', () => {
    const back = { top: 0, under: 1, dir: 'back' } as const

    expect(settlePlan(back, true, 1, 100, PW, R)).toStrictEqual({
      to: PW,
      target: 0,
      ms: 160 + (440 * 200) / 345,
    })
    expect(settlePlan(back, false, 1, 100, PW, R)).toStrictEqual({
      to: -45,
      target: 1,
      ms: 160 + (440 * 145) / 345,
    })
  })

  it('eases xm to its end and the lean to 0', () => {
    const s = settleAt(100, -45, 0.2, 0.25)

    expect(s.xm).toBeCloseTo(63.75, 12)
    expect(s.beta).toBeCloseTo(0.15, 12)
  })
})

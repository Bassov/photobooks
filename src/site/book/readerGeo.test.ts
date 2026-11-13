import { describe, expect, it } from 'vitest'
import {
  backShell,
  backingSize,
  boardShades,
  canDrag,
  clickStep,
  cursorOf,
  followPlan,
  frontShell,
  geoOf,
  glBox,
  glPose,
  liftAt,
  moveIntent,
  openShell,
  pagePxOf,
  paperStrips,
  readOf,
  edgesOf,
  readerKey,
  releasePlan,
  stepFrom,
  thetaAt,
  turnMs,
  turnShell,
  type GeoBook,
} from './readerGeo'

const book = (w: number, pageCount: number): GeoBook => ({
  trimMm: { w },
  pageCount,
  spine: { cloth: '#123' },
})
/** 20 × 20 cm trim at 800 px: 20 px/cm, BD 6, thickness 30, eMax 9, tE 3.15; 9 spreads */
const G = geoOf(book(200, 18), 800, 500, 11)
const near = (x: number): unknown => expect.closeTo(x, 6)
/** the black alphas of a shade, in order */
const alphas = (shade: unknown) =>
  [...String(shade).matchAll(/rgb\(0 0 0\/([-\d.e]+)\)/g)].map((m) =>
    Number(m[1]),
  )
const BOTTOM =
  'linear-gradient(0deg, color-mix(in srgb, #123 85%, #000) 0 7px, transparent 7px), #123'

describe('geoOf', () => {
  it('derives board, edge and tail sizes from the trim and page count', () => {
    expect(G).toEqual({
      W: 800,
      H: 500,
      pw: 400,
      n: 11,
      board: '#123',
      BD: 6,
      eMax: near(9),
      tE: near(3.15),
    })
  })

  it.each([
    // 5 px/cm: BD floors at 3, the thickness at 12 px, tE at 2
    { W: 200, pages: 18, BD: 3, eMax: 4.275, tE: 2 },
    // 50 px/cm: BD caps at 8, eMax at 14
    { W: 2000, pages: 40, BD: 8, eMax: 14, tE: 4.9 },
    // a thin book: eMax floors at 3
    { W: 800, pages: 2, BD: 6, eMax: 3, tE: 2 },
  ])('clamps a $W px book of $pages pages', ({ W, pages, BD, eMax, tE }) => {
    const g = geoOf(book(200, pages), W, 100, 11)

    expect([g.BD, g.eMax, g.tE]).toEqual([near(BD), near(eMax), near(tE)])
  })
})

describe('readOf / edgesOf', () => {
  it.each([
    [0, 0],
    [1, 0],
    [3, 0.25],
    [5, 0.5],
    [9, 1],
    [10, 1],
  ])('view %i is read %f', (v, r) => {
    expect(readOf(G, v)).toBe(r)
  })

  it('reads a one-spread book as unread', () => {
    expect(readOf(geoOf(book(200, 2), 800, 500, 3), 1)).toBe(0)
  })

  it('piles the read pages on the left edge', () => {
    expect(edgesOf(G, 0.25)).toEqual([3, 7])
    expect(edgesOf(G, 1)).toEqual([9, 1])
  })
})

describe('openShell', () => {
  it('places both boards, edges, the tail, the halves and the gutter of view 3', () => {
    const s = openShell(G, 3)

    expect(s.transform).toBeUndefined()
    expect(s.boards).toEqual([
      {
        left: -9,
        top: -6,
        width: 409,
        height: near(515.15),
        background: BOTTOM,
        borderRadius: '3px 0 0 3px',
      },
      {
        left: 400,
        top: -6,
        width: 413,
        height: near(515.15),
        background: BOTTOM,
        borderRadius: '0 3px 3px 0',
      },
    ])
    expect(s.edges).toEqual([
      {
        left: -3,
        top: 1,
        width: 3,
        height: 499,
        boxShadow: 'inset 3px 0 3px -3px rgb(0 0 0/.12)',
      },
      {
        left: 800,
        top: 1,
        width: 7,
        height: 499,
        boxShadow: 'inset -7px 0 7px -7px rgb(0 0 0/.12)',
      },
    ])
    expect(s.tail).toMatchObject({
      left: -3,
      top: 500,
      width: 810,
      height: near(3.15),
    })
    expect(s.tail?.boxShadow).toMatch(
      /^inset 0 -3\.1\d*px 3\.1\d*px -3\.1\d*px rgb\(0 0 0\/\.15\)$/,
    )
    expect(s.pages).toEqual([
      { v: 3, side: 'L', style: { left: 0, top: 0, width: 400, height: 500 } },
      {
        v: 3,
        side: 'R',
        style: { left: 400, top: 0, width: 400, height: 500 },
      },
    ])
    expect(s.gutter).toEqual({
      left: 368,
      top: 0,
      width: 64,
      height: 500,
      transform: undefined,
    })
  })
})

describe('frontShell / backShell', () => {
  it('shows the closed front: the right board and the cover, half a page left', () => {
    const s = frontShell(G)

    expect(s).toEqual({
      transform: 'translateX(-200px)',
      boards: [
        {
          left: 400,
          top: -6,
          width: 415,
          height: near(515.15),
          background: BOTTOM,
          borderRadius: '0 3px 3px 0',
        },
      ],
      edges: [
        {
          left: 800,
          top: 1,
          width: near(9),
          height: 499,
          boxShadow: expect.stringMatching(/^inset -9\.?\d*px 0 /),
        },
      ],
      tail: null,
      pages: [],
      gutter: null,
      cover: {
        left: 400,
        top: -6,
        width: 406,
        height: 512,
        borderRadius: '1px 3px 3px 1px',
        overflow: 'hidden',
      },
    })
  })

  it('shows the closed back: the left board outside up, half a page right', () => {
    const s = backShell(G)

    expect(s).toEqual({
      transform: 'translateX(200px)',
      boards: [
        {
          left: near(-15),
          top: -6,
          width: near(415),
          height: near(515.15),
          background: BOTTOM,
          borderRadius: '3px 0 0 3px',
        },
      ],
      edges: [
        {
          left: near(-9),
          top: 1,
          width: near(9),
          height: 499,
          boxShadow: expect.stringMatching(/^inset 9\.?\d*px 0 /),
        },
      ],
      tail: null,
      pages: [],
      gutter: null,
      back: {
        left: -6,
        top: -6,
        width: 406,
        height: 512,
        background:
          'linear-gradient(270deg, rgb(0 0 0/.18), rgb(0 0 0/0) 6%), #123',
        borderRadius: '3px 1px 1px 3px',
      },
    })
  })
})

describe('turnShell', () => {
  it('turns a paper leaf mid-book: both boards, the tail, a lifted gutter, the right cast', () => {
    const s = turnShell(G, 3, 90)

    expect(s.transform).toBe('translateX(0px)')
    expect(s.opening).toBe(false)
    expect(s.board).toBeNull()
    // read 0.25 → 0.375, half-way: 0.3125
    expect(s.edges.map((e) => e.width)).toEqual([3.5, 6.5])
    expect(s.boards.map((b) => [b.left, b.width])).toEqual([
      [-9.5, 409.5],
      [400, 412.5],
    ])
    expect(s.tail).toMatchObject({ left: -3.5, width: 810 })
    expect(s.pages.map((p) => [p.v, p.side])).toEqual([
      [3, 'L'],
      [4, 'R'],
    ])
    expect(s.gutter?.transform).toBe('translateZ(.5px)')
    expect(s.casts).toEqual([
      {
        left: 400,
        top: 0,
        width: near(158),
        height: 500,
        background: 'linear-gradient(90deg, rgb(0 0 0/0.34), rgb(0 0 0/0))',
      },
    ])
  })

  it('casts the turned leaf on the left page past 92°', () => {
    const s = turnShell(G, 3, 120)

    expect(s.casts).toHaveLength(2)
    expect(s.casts[0]).toMatchObject({ width: near(400 * (0.12 + 0.55 / 3)) })
    expect(alphas(s.casts[0]?.background)).toEqual([near(0.34 * 0.8660254), 0])
    expect(s.casts[1]).toMatchObject({
      left: near(400 - 140 / 3),
      top: 0,
      width: near(140 / 3),
      height: 500,
    })
    expect(alphas(s.casts[1]?.background)).toEqual([near(0.26 * 0.8660254), 0])
    expect(String(s.casts[1]?.background)).toMatch(/^linear-gradient\(270deg, /)
  })

  it.each([
    [0, 0],
    [1, 1],
    [92, 1],
    [93, 2],
    [177, 2],
    [178, 1],
  ])('a leaf at %i° casts %i shadows', (th, casts) => {
    expect(turnShell(G, 3, th).casts).toHaveLength(casts)
  })

  it('opens the front board: the book slides from half a page left, the cover leaf turns', () => {
    const s = turnShell(G, 0, 90)

    expect(s.opening).toBe(true)
    expect(s.transform).toBe('translateX(-100px)')
    expect(s.boards.map((b) => [b.left, b.width])).toEqual([[400, 415]])
    expect(s.edges.map((e) => [e.left, e.width])).toEqual([[800, 9]])
    expect(s.tail).toBeNull()
    expect(s.gutter).toBeNull()
    expect(s.pages.map((p) => [p.v, p.side])).toEqual([[1, 'R']])
    expect(s.casts).toHaveLength(1)
    expect(s.board).toEqual({
      style: {
        left: 400,
        top: -6,
        width: 406,
        height: 512,
        transform: 'translateZ(1px) rotateY(-90deg)',
        willChange: 'transform',
      },
      face: { background: '#123', borderRadius: '0 3px 3px 0' },
      endpaper: { left: 6, top: 6, right: 0, bottom: 6 },
      frontShade:
        'linear-gradient(90deg, rgb(0 0 0/0.22), rgb(0 0 0/0.06) 35%, rgb(0 0 0/0) 70%), rgb(0 0 0/0)',
      backShade:
        'linear-gradient(270deg, rgb(0 0 0/0.2), rgb(0 0 0/0) 40%), rgb(0 0 0/0)',
    })
  })

  it('opens with no left cast even past 92°', () => {
    expect(turnShell(G, 0, 150).casts).toHaveLength(1)
    expect(turnShell(G, 0, 0).transform).toBe('translateX(-200px)')
  })

  it('closes the back board: the book slides half a page right, the endpaper on the leaf front', () => {
    const s = turnShell(G, 9, 90)

    expect(s.opening).toBe(false)
    expect(s.transform).toBe('translateX(100px)')
    expect(s.boards.map((b) => [b.left, b.width])).toEqual([[-15, 415]])
    expect(s.edges.map((e) => [e.left, e.width])).toEqual([[-9, 9]])
    expect(s.tail).toBeNull()
    expect(s.gutter).toBeNull()
    expect(s.pages.map((p) => [p.v, p.side])).toEqual([[9, 'L']])
    expect(s.casts).toEqual([])
    expect(s.board?.endpaper).toEqual({ left: 0, top: 6, right: 6, bottom: 6 })
    expect(turnShell(G, 9, 180).casts).toHaveLength(1)
  })

  it('shades the board leaf by its angle', () => {
    const s = turnShell(G, 0, 45)

    expect(alphas(s.board?.frontShade)).toEqual([
      near(0.22 * Math.SQRT1_2),
      near(0.06 * Math.SQRT1_2),
      0,
      near(0.14),
    ])
    expect(alphas(turnShell(G, 9, 135).board?.backShade)).toEqual([
      near(0.2 * Math.SQRT1_2),
      0,
      near(0.15),
    ])
  })
})

describe('boardShades', () => {
  it.each([
    [
      45,
      [0.22 * Math.SQRT1_2, 0.06 * Math.SQRT1_2, 0.14],
      [0.2 * Math.SQRT1_2, 0],
    ],
    [90, [0.22, 0.06, 0], [0.2, 0]],
    [
      135,
      [0.22 * Math.SQRT1_2, 0.06 * Math.SQRT1_2, 0],
      [0.2 * Math.SQRT1_2, 0.15],
    ],
  ])('at %i° shades front %j, back %j', (th, front, back) => {
    const s = boardShades(th)

    expect(s.front).toEqual(front.map(near))
    expect(s.back).toEqual(back.map(near))
  })
})

describe('paperStrips', () => {
  const sw = 400 / 12

  it('bends twelve strips around the leaf angle mid-turn', () => {
    const s = paperStrips(G, 90)

    expect(s).toHaveLength(12)
    expect(s.map((x) => x.angle)).toEqual(
      [
        62.5, 63.333, 65, 67.5, 70.833, 75, 80, 85.833, 92.5, 100, 108.333,
        117.5,
      ].map((a): unknown => expect.closeTo(a, 2)),
    )
    expect(s[0]?.style).toEqual({
      position: 'absolute',
      left: 400,
      top: 0,
      width: near(sw + 1.5),
      height: 500,
      transformStyle: 'preserve-3d',
      transformOrigin: 'left center',
      transform: 'translateZ(1px) rotateY(-62.5deg)',
    })
    expect(s[6]?.style).toMatchObject({
      left: near(sw),
      transform: 'rotateY(-5deg)',
    })
    expect(s[3]?.style.transform).toBe('rotateY(-2.5deg)')
  })

  it.each([
    // strip, front x, back x, sheen, front shade, back shade
    [0, 0, sw - 400, 0, 0.34 * (62.5 / 90), 0],
    [6, -200, 7 * sw - 400, 0.16, 0.34 * (80 / 90), 0],
    [
      11,
      -11 * sw,
      0,
      0.16 * Math.sin((11 * Math.PI) / 12),
      0,
      0.3 * (62.5 / 90),
    ],
  ])(
    'places strip %i faces and shades',
    (i, frontX, backX, hi, front, back) => {
      const st = paperStrips(G, 90)[i]

      expect(st).toMatchObject({
        frontX: near(frontX),
        backX: near(backX),
        hi: near(hi),
        front: near(front),
        back: near(back),
      })
    },
  )

  it('lies flat at rest', () => {
    const s = paperStrips(G, 0)

    expect(s.map((x) => [x.angle, x.hi, x.front, x.back])).toEqual(
      Array.from({ length: 12 }, () => [0, 0, 0, 0]),
    )
    expect(s[5]?.style.transform).toBe('rotateY(0deg)')
  })
})

describe('followPlan', () => {
  const lift = (a: number, th: number) => ({ a, th, kind: 'lift' as const })

  it.each([
    ['reduced motion', 4, 3, true, null, { fade: 160 }],
    ['a jump', 5, 3, false, null, { fade: 240 }],
    ['a step on', 4, 3, false, null, { a: 3, th0: 0, th1: 180, ms: 820 }],
    ['a step back', 3, 4, false, null, { a: 3, th0: 180, th1: 0, ms: 820 }],
    ['the cover', 1, 0, false, null, { a: 0, th0: 0, th1: 180, ms: 1000 }],
    [
      'the back board',
      10,
      9,
      false,
      null,
      { a: 9, th0: 0, th1: 180, ms: 1000 },
    ],
    ['the last leaf', 9, 8, false, null, { a: 8, th0: 0, th1: 180, ms: 820 }],
    [
      'a lifted corner',
      4,
      3,
      false,
      lift(3, 10),
      { a: 3, th0: 10, th1: 180, ms: near(820 * (170 / 180)) },
    ],
    [
      'another corner',
      4,
      3,
      false,
      lift(2, 170),
      { a: 3, th0: 0, th1: 180, ms: 820 },
    ],
  ])('plans %s', (_, view, shown, reduce, l, plan) => {
    expect(followPlan(view, shown, 11, reduce, l)).toEqual(plan)
  })

  it('turns for at least 200 ms', () => {
    expect(turnMs(820, 0, 30)).toBe(200)
    expect(turnMs(820, 90, 0)).toBe(410)
  })
})

describe('stepFrom', () => {
  it.each([
    [5, 1, 6],
    [9, 1, 10],
    [10, 1, null],
    [10, -1, 9],
    [0, -1, null],
    [0, 3, 3],
  ])('steps %i by %i to %s', (v, d, t) => {
    expect(stepFrom(v, d, 11)).toBe(t)
  })
})

describe('readerKey', () => {
  const k = (key: string, init: KeyboardEventInit = {}, target?: unknown) => {
    const e = new KeyboardEvent('keydown', { key, ...init })
    if (target !== undefined)
      Object.defineProperty(e, 'target', { value: target })
    return readerKey(e)
  }

  it('maps arrows and page keys to steps and Home / End to jumps', () => {
    expect(
      ['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', 'Home', 'End', 'a'].map(
        (x) => k(x),
      ),
    ).toEqual([1, 1, -1, -1, 'home', 'end', null])
  })

  it('leaves modified keys and text fields alone, but not Shift', () => {
    expect(k('ArrowRight', { altKey: true })).toBeNull()
    expect(k('ArrowRight', { ctrlKey: true })).toBeNull()
    expect(k('ArrowRight', { metaKey: true })).toBeNull()
    expect(k('ArrowRight', { shiftKey: true })).toBe(1)
    expect(k('End', {}, document.createElement('textarea'))).toBeNull()
    expect(k('End', {}, document.createElement('div'))).toBe('end')
    expect(k('End', {}, window)).toBe('end')
  })
})

describe('pointer decisions', () => {
  it.each([
    ['R', 0, false],
    ['R', 1, true],
    ['R', 8, true],
    ['R', 9, false],
    ['L', 1, false],
    ['L', 2, true],
    ['L', 9, true],
    ['L', 10, false],
  ] as const)('drags side %s on view %i: %s', (side, shown, ok) => {
    expect(canDrag(side, shown, 11)).toBe(ok)
  })

  it.each([
    [800, 0],
    [1000, 0],
    [600, 60],
    [400, 90],
    [0, 180],
    [-500, 180],
  ])('reads the leaf at x %i as %f°', (x, th) => {
    expect(thetaAt(x, 400, 400)).toBeCloseTo(th, 9)
  })

  it('labels the cursor', () => {
    expect([
      cursorOf(0, 11, 'L'),
      cursorOf(10, 11, 'R'),
      cursorOf(5, 11, 'R'),
      cursorOf(5, 11, 'L'),
    ]).toEqual(['Open', '←', '→', '←'])
  })

  it.each([
    ['mouse', 3, 4, 'wait'],
    ['mouse', 6, 0, 'wait'],
    ['mouse', 6.5, 0, 'drag'],
    ['mouse', 0, 7, 'drag'],
    ['touch', 2, 7, 'scroll'],
    ['touch', 0, 6, 'wait'],
    ['touch', 6, 0, 'wait'],
    ['touch', 7, 7, 'drag'],
    ['touch', 7, 7.5, 'scroll'],
    ['pen', 6.5, 6, 'drag'],
  ])('reads a %s move of %f, %f as %s', (type, dx, dy, intent) => {
    expect(moveIntent(type, dx, dy)).toBe(intent)
  })

  it.each([
    [736, 250, null],
    [736.5, 250, { a: 3, th0: 0, th: 10 }],
    [808, 250, { a: 3, th0: 0, th: 10 }],
    [808.5, 250, null],
    [63.5, 250, { a: 2, th0: 180, th: 170 }],
    [64, 250, null],
    [-8, 250, { a: 2, th0: 180, th: 170 }],
    [-8.5, 250, null],
    [790, 0, { a: 3, th0: 0, th: 10 }],
    [790, -0.5, null],
    [790, 500, { a: 3, th0: 0, th: 10 }],
    [790, 500.5, null],
  ])('lifts the corner at %f, %f on view 3: %j', (x, y, want) => {
    expect(liftAt(x, y, 800, 500, 3, 11)).toEqual(want)
  })

  it('lifts no corner that cannot turn', () => {
    expect(liftAt(790, 250, 800, 500, 9, 11)).toBeNull()
    expect(liftAt(10, 250, 800, 500, 1, 11)).toBeNull()
  })

  it.each([
    [194, 'L', 0, 1],
    [193.5, 'L', 0, 0],
    [606, 'R', 0, 1],
    [606.5, 'R', 0, 0],
    [194, 'R', 10, -1],
    [100, 'L', 10, 0],
    [606.5, 'R', 10, 0],
    [10, 'R', 5, 1],
    [790, 'L', 5, -1],
  ] as const)(
    'steps a click at %f on %s of view %i by %i',
    (x, side, shown, d) => {
      expect(clickStep(x, side, G, shown)).toBe(d)
    },
  )

  it.each([
    [
      'past the spine',
      true,
      91,
      0,
      0,
      { to: 180, target: 6, ms: near(820 * (89 / 180)) },
    ],
    ['at the spine', true, 90, 0, 0, { to: 0, target: 5, ms: 410 }],
    [
      'a fling',
      true,
      30,
      -0.6,
      100,
      { to: 180, target: 6, ms: near(820 * (150 / 180)) },
    ],
    ['a rested fling', true, 30, -0.6, 101, { to: 0, target: 5, ms: 200 }],
    ['a slow move', true, 30, -0.5, 0, { to: 0, target: 5, ms: 200 }],
    [
      'back past the spine',
      false,
      89,
      0,
      0,
      { to: 0, target: 4, ms: near(820 * (89 / 180)) },
    ],
    ['back at the spine', false, 90, 0, 0, { to: 180, target: 5, ms: 410 }],
    [
      'a back fling',
      false,
      150,
      0.6,
      0,
      { to: 0, target: 4, ms: near(820 * (150 / 180)) },
    ],
    ['a slow back move', false, 150, 0.5, 0, { to: 180, target: 5, ms: 200 }],
  ])('releases %s', (_, fwd, th, vx, rest, plan) => {
    expect(releasePlan(fwd, th, vx, rest, 5)).toEqual(plan)
  })
})

describe('GL placement', () => {
  it('poses the rest and the turn', () => {
    expect(glPose(null, 3, 11)).toEqual([3, 0])
    expect(glPose(null, 0, 11)).toEqual([0, 0])
    expect(glPose(null, 10, 11)).toEqual([9, 180])
    expect(glPose({ a: 4, th: 33, kind: 'drag' }, 3, 11)).toEqual([4, 33])
  })

  it('overhangs the reader box and sizes the backing store', () => {
    const box = glBox(1000, 500)

    expect(box).toEqual({ x: -40, y: -210, w: 1080, h: 735 })
    expect(backingSize(box, 1)).toEqual({ w: 2160, h: 1470 })
    expect(backingSize(box, 3)).toEqual({ w: 3240, h: 2205 })
    expect(backingSize(box, 5)).toEqual({ w: 4096, h: 2788 })
    expect(backingSize({ w: 100, h: 2048 }, 3)).toEqual({ w: 200, h: 4096 })
  })

  it('picks the page texture size by width', () => {
    expect([pagePxOf(1599), pagePxOf(1600)]).toEqual([1024, 2048])
  })
})

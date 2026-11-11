import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveSpread,
  setParentPageNumbers,
  type Book,
  type Frame,
} from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { frameBox } from './frameBox'
import {
  breakTextLines,
  paintPage,
  type PageContext,
  type PageImage,
} from './pagePainter'

type Call = [string, ...unknown[]]
interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}
/** Device-space bounding box: left, top, right, bottom. */
type Box = [number, number, number, number]
interface Placed {
  m: Matrix
  clips: Box[][]
  path: Box[]
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const placed = new WeakMap<Call, Placed>()

/** Where `call` ran: its transform, clip stack and current path. */
const at = (call: Call | undefined): Placed =>
  (call && placed.get(call)) ?? { m: IDENTITY, clips: [], path: [] }

const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0

function deviceBox(m: Matrix, x: number, y: number, w: number, h: number): Box {
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px = 0, py = 0]) => [
    m.a * px + m.c * py + m.e,
    m.b * px + m.d * py + m.f,
  ])
  const xs = corners.map(([cx = 0]) => cx)
  const ys = corners.map(([, cy = 0]) => cy)
  return [
    round(Math.min(...xs)),
    round(Math.min(...ys)),
    round(Math.max(...xs)),
    round(Math.max(...ys)),
  ]
}

/** Device box of a drawImage call's destination rect. */
const imageBox = (call: Call | undefined) => {
  const [x, y, w, h] = (call ?? []).slice(-4) as number[]
  return deviceBox(at(call).m, x ?? 0, y ?? 0, w ?? 0, h ?? 0)
}

/**
 * Strict 2D context double: records calls with the transform, clips and path
 * they ran under; save / restore carry state and must balance.
 */
function recorder() {
  const calls: Call[] = []
  let m = IDENTITY
  let clips: Box[][] = []
  let path: Box[] = []
  const stack: { m: Matrix; clips: Box[][]; props: object }[] = []
  const log = (call: Call) => {
    calls.push(call)
    placed.set(call, { m, clips, path })
  }
  const mul = (n: Matrix) => {
    m = {
      a: m.a * n.a + m.c * n.b,
      b: m.b * n.a + m.d * n.b,
      c: m.a * n.c + m.c * n.d,
      d: m.b * n.c + m.d * n.d,
      e: m.a * n.e + m.c * n.f + m.e,
      f: m.b * n.e + m.d * n.f + m.f,
    }
  }
  const fontPx = () => parseFloat(/([\d.]+)px/.exec(ctx.font)?.[1] ?? '10')
  const ctx = {
    fillStyle: '' as unknown,
    font: '10px sans-serif',
    textAlign: 'start',
    filter: 'none',
    imageSmoothingQuality: 'low',
    save: () => {
      const { fillStyle, font, textAlign, filter } = ctx
      stack.push({ m, clips, props: { fillStyle, font, textAlign, filter } })
      log(['save'])
    },
    restore: () => {
      const state = stack.pop()
      if (state === undefined) throw new Error('restore without save')
      ;({ m, clips } = state)
      Object.assign(ctx, state.props)
      log(['restore'])
    },
    translate: (x: number, y: number) => {
      mul({ a: 1, b: 0, c: 0, d: 1, e: x, f: y })
      log(['translate', x, y])
    },
    rotate: (rad: number) => {
      const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
      mul({ a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 })
      log(['rotate', rad])
    },
    scale: (x: number, y: number) => {
      mul({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 })
      log(['scale', x, y])
    },
    getTransform: () => m,
    beginPath: () => {
      path = []
      log(['beginPath'])
    },
    rect: (x: number, y: number, w: number, h: number) => {
      path = [...path, deviceBox(m, x, y, w, h)]
      log(['rect', x, y, w, h])
    },
    roundRect: (x: number, y: number, w: number, h: number, r: number) => {
      path = [...path, deviceBox(m, x, y, w, h)]
      log(['roundRect', x, y, w, h, r])
    },
    clip: () => {
      clips = [...clips, path]
      log(['clip'])
    },
    fill: () => {
      log(['fill', ctx.fillStyle])
    },
    fillRect: (...args: number[]) => {
      log(['fillRect', ctx.fillStyle, ...args])
    },
    drawImage: (image: unknown, ...args: number[]) => {
      log(['drawImage', image, ctx.filter, ...args])
    },
    fillText: (text: string, x: number, y: number) => {
      log(['fillText', text, x, y, ctx.font, ctx.fillStyle])
    },
    measureText: (text: string) => ({
      width: text.length * fontPx() * 0.5,
      fontBoundingBoxAscent: fontPx() * 0.8,
      fontBoundingBoxDescent: fontPx() * 0.2,
    }),
  }
  return {
    ctx: ctx as unknown as PageContext,
    calls,
    depth: () => stack.length,
  }
}

const of = (calls: Call[], name: string) => calls.filter((c) => c[0] === name)

const image = (width: number, height: number) =>
  ({ width, height }) as unknown as PageImage

/** 100 × 200 mm pages; spreads s0 (page 1), s1 (pages 2–3), s2 (page 4). */
function book(frames: Partial<Record<'s0' | 's1' | 's2', Frame[]>> = {}) {
  return makeBook({
    settings: { trim: { widthMm: 100, heightMm: 200 } },
    assets: { a: { widthPx: 300, heightPx: 200 } },
    spreads: (['s0', 's1', 's2'] as const).map((id) =>
      makeSpread({ id, frames: frames[id] ?? [] }),
    ),
  })
}

const photo = (patch: Partial<Frame> = {}): Frame =>
  makeFrame({
    id: 'p',
    rect: { x: 10, y: 20, width: 30, height: 20 },
    assetId: 'a',
    crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    ...patch,
  })

const text = (body: string, patch: Partial<Frame> = {}): Frame =>
  makeFrame({
    id: 't',
    rect: { x: 0, y: 0, width: 50, height: 100 },
    kind: 'text',
    styleId: 'body',
    align: 'left',
    content: { type: 'static', text: body },
    ...patch,
  })

const numberedBook = () =>
  setParentPageNumbers(
    makeBook({
      ...book(),
      parents: [{ id: 'pA', name: 'A', frames: [], guides: [] }],
      defaultParentId: 'pA',
    }),
    'pA',
    'outer',
  )

/** Paint at 2 px/mm onto a context already scaled by `deviceScale`. */
async function paint(
  b: Book,
  page: number,
  images = new Map(),
  deviceScale = 1,
) {
  const { ctx, calls, depth } = recorder()
  if (deviceScale !== 1) ctx.scale(deviceScale, deviceScale)
  await paintPage(ctx, b, page, images, 2)
  expect(depth()).toBe(0)
  return calls
}

/** The page clip every page paints under, in device px at 2 px/mm. */
const PAGE: Box[] = [[0, 0, 200, 400]]

describe('breakTextLines', () => {
  const measure = (s: string) => s.length

  it('keeps text that fits on one line', () => {
    expect(breakTextLines(measure, 'ab cd', 5)).toEqual(['ab cd'])
    expect(breakTextLines(measure, '', 5)).toEqual([''])
  })

  it('breaks greedily at spaces, trailing spaces hang', () => {
    expect(breakTextLines(measure, 'aaa bbb ccc', 7)).toEqual([
      'aaa bbb',
      'ccc',
    ])
    expect(breakTextLines(measure, 'aaa    bbb', 3)).toEqual(['aaa', 'bbb'])
    expect(breakTextLines(measure, '  ab', 9)).toEqual(['  ab'])
  })

  it('keeps hard breaks and empty paragraphs', () => {
    expect(breakTextLines(measure, 'a\n\nb ', 9)).toEqual(['a', '', 'b'])
  })

  it('splits a word wider than the box anywhere, on its own line', () => {
    expect(breakTextLines(measure, 'abcdefgh', 3)).toEqual(['abc', 'def', 'gh'])
    expect(breakTextLines(measure, 'xx abcdefg yy', 3)).toEqual([
      'xx',
      'abc',
      'def',
      'g',
      'yy',
    ])
    // Spaces after a split word hang; they never open a line.
    expect(breakTextLines(measure, 'abcdef  x', 3)).toEqual(['abc', 'def', 'x'])
    // A box narrower than one character still takes one per line.
    expect(breakTextLines(measure, 'ab', 0)).toEqual(['a', 'b'])
  })
})

describe('paintPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'fonts')
  })

  it('rejects pages the book does not have', async () => {
    for (const page of [0, 1.5, 5]) {
      await expect(paint(book(), page)).rejects.toThrow(RangeError)
    }
  })

  it('fills the page colour clipped to the page, paper by default', async () => {
    const calls = await paint(book(), 1)
    const fill = of(calls, 'fillRect')[0]
    expect(fill).toEqual(['fillRect', '#ffffff', 0, 0, 200, 400])
    expect(at(fill).clips).toEqual([PAGE])
    // A path the caller left open does not widen the page clip.
    const { ctx, calls: open } = recorder()
    ctx.beginPath()
    ctx.rect(0, 0, 999, 999)
    await paintPage(ctx, book(), 1, new Map(), 2)
    expect(at(of(open, 'fillRect')[0]).clips).toEqual([PAGE])
    const coloured = makeBook({
      ...book(),
      settings: { trim: { widthMm: 100, heightMm: 200 }, pageColor: '#102030' },
    })
    expect(of(await paint(coloured, 2), 'fillRect')[0]?.[1]).toBe('#102030')
  })

  it('shifts a right page by the trim width; single pages start at 0', async () => {
    const shift = async (page: number) =>
      of(await paint(book(), page), 'translate')[0]
    expect(await shift(3)).toEqual(['translate', -200, 0])
    expect(await shift(2)).toEqual(['translate', -0, 0])
    expect(await shift(1)).toEqual(['translate', -0, 0])
    expect(await shift(4)).toEqual(['translate', -0, 0])
  })

  it('places a photo frame on its page, the photo clipped to the body', async () => {
    const bitmap = image(300, 200)
    const calls = await paint(
      book({ s1: [photo({ rect: { x: 110, y: 20, width: 30, height: 20 } })] }),
      3,
      new Map([['a', bitmap]]),
    )
    const [paper] = of(calls, 'fillRect').slice(-1)
    expect(deviceBox(at(paper).m, 0, 0, 60, 40)).toEqual([20, 40, 80, 80])
    const drawn = of(calls, 'drawImage')[0]
    expect(drawn?.[1]).toBe(bitmap)
    expect(imageBox(drawn)).toEqual([20, 40, 80, 80])
    expect(at(drawn).clips).toEqual([PAGE, [[20, 40, 80, 80]]])
  })

  it('draws a photo in the crop box its own aspect gives', async () => {
    const bitmap = image(600, 600)
    const calls = await paint(
      book({ s1: [photo()] }),
      2,
      new Map([['a', bitmap]]),
    )
    const [, drawn, filter, ...rect] = of(calls, 'drawImage')[0] ?? []
    expect(drawn).toBe(bitmap)
    expect(filter).toBe('none')
    // 60 × 40 px frame: the square photo overhangs it top and bottom.
    expect(rect).toEqual([-30, -30, 60, 60])
    expect(of(calls, 'fillRect').at(-1)).toEqual([
      'fillRect',
      '#ffffff',
      0,
      0,
      60,
      40,
    ])
    // An `<img>` reports its natural size, not its layout size.
    const img = {
      naturalWidth: 300,
      naturalHeight: 200,
      width: 1,
      height: 1,
    } as unknown as PageImage
    const natural = await paint(
      book({ s1: [photo()] }),
      2,
      new Map([['a', img]]),
    )
    expect(of(natural, 'drawImage')[0]?.slice(-4)).toEqual([-30, -20, 60, 40])
  })

  it('crops, turns and filters the photo about the frame centre', async () => {
    const calls = await paint(
      book({
        s1: [
          photo({
            rotationDeg: 90,
            adjust: { brightness: 10, contrast: 0, saturation: -50 },
            crop: {
              zoom: 2,
              center: { x: 0.5, y: 0.5 },
              quarterTurns: 1,
              flipH: true,
            },
          }),
        ],
      }),
      2,
      new Map([['a', image(300, 200)]]),
    )
    expect(of(calls, 'rotate').map((c) => c[1])).toEqual([
      Math.PI / 2,
      Math.PI / 2,
    ])
    expect(of(calls, 'scale')).toEqual([['scale', -1, 1]])
    const drawn = of(calls, 'drawImage')[0]
    expect(drawn?.[2]).toBe('brightness(1.1) contrast(1) saturate(0.5)')
    // Turned image box (`turnedPhotoStyle`), drawn unsnapped about the centre.
    expect(drawn?.slice(-4)).toEqual([-90, -60, 180, 120])
    // The frame turns about its centre (50, 60): 40 × 60 px on the page.
    const [paper] = of(calls, 'fillRect').slice(-1)
    expect(deviceBox(at(paper).m, 0, 0, 60, 40)).toEqual([30, 30, 70, 90])
  })

  it('shifts a zoomed crop to its centre', async () => {
    const calls = await paint(
      book({ s1: [photo({ crop: { zoom: 2, center: { x: 0.25, y: 0.5 } } })] }),
      2,
      new Map([['a', image(300, 200)]]),
    )
    // Twice the frame, its left edge on the frame's: [20, 40, 80, 80].
    expect(imageBox(of(calls, 'drawImage')[0])).toEqual([20, 20, 140, 100])
  })

  it('flips the photo across either axis', async () => {
    const flipped = async (flip: { flipH?: true; flipV?: true }) =>
      of(
        await paint(
          book({
            s1: [
              photo({ crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, ...flip } }),
            ],
          }),
          2,
          new Map([['a', image(300, 200)]]),
        ),
        'drawImage',
      )[0]
    const h = await flipped({ flipH: true })
    expect([at(h).m.a, at(h).m.d]).toEqual([-1, 1])
    const v = await flipped({ flipV: true })
    expect([at(v).m.a, at(v).m.d]).toEqual([1, -1])
    expect(imageBox(v)).toEqual([20, 40, 80, 80])
  })

  it('snaps an untransformed photo to device pixels, as Chromium does', async () => {
    const drawn = async (
      patch: Partial<Frame>,
      deviceScale = 1,
    ): Promise<Call | undefined> =>
      of(
        await paint(
          book({
            s1: [
              photo({
                rect: { x: 10.3, y: 20.3, width: 30, height: 20 },
                ...patch,
              }),
            ],
          }),
          2,
          new Map([['a', image(300, 200)]]),
          deviceScale,
        ),
        'drawImage',
      )[0]
    // Frame at 20.6, 40.6 px: edges round to whole device pixels.
    expect(imageBox(await drawn({}))).toEqual([21, 41, 81, 81])
    expect(imageBox(await drawn({}, 3))).toEqual([62, 122, 242, 242])
    // Turned or flipped boxes are not snapped.
    expect((await drawn({ rotationDeg: 5 }))?.slice(-4)).toEqual([
      -30, -20, 60, 40,
    ])
    const flip = { zoom: 1, center: { x: 0.5, y: 0.5 } }
    for (const crop of [
      { ...flip, flipH: true },
      { ...flip, flipV: true },
    ]) {
      expect((await drawn({ crop }))?.slice(-4)).toEqual([-30, -20, 60, 40])
    }
    // A collapsed axis has no device pixels to snap to.
    for (const [x, y] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const { ctx, calls } = recorder()
      ctx.scale(x, y)
      const images = new Map([['a', image(300, 200)]])
      await paintPage(ctx, book({ s1: [photo()] }), 2, images, 2)
      expect(of(calls, 'drawImage')[0]?.slice(-4)).toEqual([-30, -20, 60, 40])
    }
  })

  it('paints only paper for a frame whose photo is not loaded', async () => {
    const calls = await paint(book({ s1: [photo()] }), 2)
    expect(of(calls, 'drawImage')).toEqual([])
    expect(of(calls, 'fill')).toEqual([['fill', '#ffffff']])
  })

  it('paints the stroke ring, then the mat ring, then the rounded body', async () => {
    const styled = (look: object) =>
      makeBook({
        ...book({ s1: [photo({ frameStyleId: 'look' })] }),
        frameStyles: { look: { matMm: 0, cornerRadiusMm: 0, ...look } },
      })
    const calls = await paint(
      styled({
        strokeMm: 1.2,
        strokeColor: '#111111',
        matMm: 2,
        matColor: '#eeeeee',
        cornerRadiusMm: 3,
      }),
      2,
    )
    expect(of(calls, 'roundRect')).toEqual([
      ['roundRect', -6.4, -6.4, 72.8, 52.8, 12.4],
      ['roundRect', -4, -4, 68, 48, 10],
      ['roundRect', -0, -0, 60, 40, 6],
    ])
    const fills = of(calls, 'fill')
    expect(fills.map((c) => c[1])).toEqual(['#111111', '#eeeeee', '#ffffff'])
    // Each ring fills its own path.
    expect(fills.map((c) => at(c).path.length)).toEqual([1, 1, 1])
    // Square corners stay square under a ring.
    expect(of(await paint(styled({ strokeMm: 1 }), 2), 'roundRect')).toEqual([
      ['roundRect', -2, -2, 64, 44, 0],
      ['roundRect', -0, -0, 60, 40, 0],
    ])
  })

  it('stacks parent items and folios under the spread frames by z', async () => {
    const numbered = setParentPageNumbers(
      makeBook({
        ...book({
          s1: [
            photo({ id: 'top', z: 2, caption: 'top' }),
            photo({ id: 'low', z: 1, caption: 'low' }),
          ],
        }),
        parents: [
          {
            id: 'pA',
            name: 'A',
            frames: [photo({ id: 'mine', caption: 'parent' })],
            guides: [],
          },
        ],
        defaultParentId: 'pA',
      }),
      'pA',
      'outer',
    )
    const calls = await paint(numbered, 2)
    expect(of(calls, 'fillText').map((c) => c[1])).toEqual([
      'parent',
      '2',
      '3',
      'low',
      'top',
    ])
  })

  it('prints whole lines of a text frame in its style and alignment', async () => {
    const lines = async (align: string) =>
      of(
        await paint(
          book({
            s1: [
              text('one two three four five', {
                align: align as Frame['align'],
                rect: { x: 0, y: 0, width: 20, height: 11 },
              }),
            ],
          }),
          2,
        ),
        'fillText',
      )
    // Body 3.6 mm × 2 = 7.2 px, 1.5 line height: two 10.8 px lines in 22 px,
    // baselines 1.8 px half-leading + 5.76 px ascent apart from the top.
    const centred = await lines('center')
    expect(centred.map((c) => c.slice(1, 4))).toEqual([
      ['one two', 20, expect.closeTo(7.56) as number],
      ['three four', 20, expect.closeTo(18.36) as number],
    ])
    expect(centred[0]?.[4]).toBe(
      "400 7.2px 'Inter Variable', system-ui, sans-serif",
    )
    expect(centred[0]?.[5]).toBe('#232220')
    expect(at(centred[0]).clips).toEqual([PAGE, [[0, 0, 40, 22]]])
    expect((await lines('right'))[0]?.[2]).toBe(40)
    expect((await lines('left'))[0]?.[2]).toBe(0)
  })

  it('cuts a long caption with an ellipsis under the frame', async () => {
    const calls = await paint(
      book({ s1: [photo({ caption: 'A caption far wider than its frame' })] }),
      2,
    )
    const call = of(calls, 'fillText')[0]
    const [, line, x, y, font, colour] = call ?? []
    // 3.1 mm × 2 = 6.2 px type, 3.1 px per char: 60 px holds 19 chars.
    expect(line).toBe('A caption far wide…')
    expect(x).toBe(0)
    // One 8.06 px line 3 px under the frame, baseline 0.93 + 4.96 px down.
    expect(y).toBeCloseTo(43 + 5.89)
    expect(at(call).m).toMatchObject({ e: 20, f: 40 })
    expect(at(call).clips).toEqual([PAGE, [[20, 83, 80, 91.06]]])
    expect(font).toBe("400 6.2px 'Inter Variable', Inter, sans-serif")
    expect(colour).toBe('#535152')
  })

  it('cuts a caption only past the frame width', async () => {
    const caption = async (body: string, widthMm: number) =>
      of(
        await paint(
          book({
            s1: [
              photo({
                caption: body,
                rect: { x: 0, y: 0, width: widthMm, height: 20 },
              }),
            ],
          }),
          2,
        ),
        'fillText',
      )[0]?.[1]
    // 62 px holds exactly 20 chars of 3.1 px.
    expect(await caption('abcdefghijklmnopqrst', 31)).toBe(
      'abcdefghijklmnopqrst',
    )
    expect(await caption('abcdefghijklmnopqrstu', 31)).toBe(
      'abcdefghijklmnopqrs…',
    )
    expect(await caption('abc', 1)).toBe('…')
  })

  it('aligns a folio in its box in the ink colour', async () => {
    const numbered = numberedBook()
    const folio = async (page: number) => {
      const call = of(await paint(numbered, page), 'fillText').find(
        (c) => c[1] === String(page),
      )
      return { call, x: Number(call?.[2]) + at(call).m.e, y: Number(call?.[3]) }
    }
    const boxes = (resolveSpread(numbered, 's1')?.folios ?? []).map((f) => ({
      box: frameBox(f.rectMm, 2),
      align: f.align,
    }))
    const [left, right] = [await folio(2), await folio(3)]
    expect(right.call?.[4]).toBe(
      "400 6.2px 'Inter Variable', Inter, sans-serif",
    )
    expect(right.call?.[5]).toBe('#232220')
    // 6.2 px type on a 1.4 line: baseline 1.24 + 4.96 px under the box top.
    const expected = boxes.map(({ box, align }) => ({
      x:
        box.left +
        (align === 'right'
          ? box.width
          : align === 'center'
            ? box.width / 2
            : 0),
      y: box.top + 6.2,
    }))
    expect([left.y, right.y]).toEqual([
      expect.closeTo(expected[0]?.y ?? NaN),
      expect.closeTo(expected[1]?.y ?? NaN),
    ])
    expect(left.x).toBeCloseTo(expected[0]?.x ?? NaN)
    expect(right.x).toBeCloseTo((expected[1]?.x ?? NaN) - 200)
  })

  it('loads the fonts for the page text before painting', async () => {
    const loads: [string, string | undefined][] = []
    const fonts = {
      load: (font: string, sample?: string) => {
        loads.push([font, sample])
        return Promise.resolve([])
      },
    }
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    })
    await paint(book({ s1: [photo({ caption: 'Hi' }), text('Yo')] }), 2)
    expect(loads.length).toBeGreaterThan(0)
    expect(
      loads.every(([, sample]) => sample === 'Hi' + 'Yo' || sample === 'YoHi'),
    ).toBe(true)
    // In a worker (no `document`) the scope's own font set loads folios too.
    loads.length = 0
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('fonts', fonts)
    await paint(numberedBook(), 2)
    expect(loads.map(([, sample]) => sample)).toContain('23')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { setParentPageNumbers, type Book, type Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  breakTextLines,
  paintPage,
  type PageContext,
  type PageImage,
} from './pagePainter'

type Call = [string, ...unknown[]]

/** 2D context double: records calls with the state they ran under. */
function recorder() {
  const calls: Call[] = []
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const stack: (typeof m)[] = []
  const mul = (n: typeof m) => {
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
      stack.push(m)
      calls.push(['save'])
    },
    restore: () => {
      m = stack.pop() ?? m
      calls.push(['restore'])
    },
    translate: (x: number, y: number) => {
      mul({ a: 1, b: 0, c: 0, d: 1, e: x, f: y })
      calls.push(['translate', x, y])
    },
    rotate: (rad: number) => {
      const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
      mul({ a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 })
      calls.push(['rotate', rad])
    },
    scale: (x: number, y: number) => {
      mul({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 })
      calls.push(['scale', x, y])
    },
    getTransform: () => m,
    beginPath: () => calls.push(['beginPath']),
    rect: (...args: number[]) => calls.push(['rect', ...args]),
    roundRect: (...args: number[]) => calls.push(['roundRect', ...args]),
    clip: () => calls.push(['clip']),
    fill: () => calls.push(['fill', ctx.fillStyle]),
    fillRect: (...args: number[]) =>
      calls.push(['fillRect', ctx.fillStyle, ...args]),
    drawImage: (image: unknown, ...args: number[]) =>
      calls.push(['drawImage', image, ctx.filter, ...args]),
    fillText: (text: string, x: number, y: number) =>
      calls.push(['fillText', text, x, y, ctx.font, ctx.fillStyle]),
    measureText: (text: string) => ({
      width: text.length * fontPx() * 0.5,
      fontBoundingBoxAscent: fontPx() * 0.8,
      fontBoundingBoxDescent: fontPx() * 0.2,
    }),
  }
  return { ctx: ctx as unknown as PageContext, calls }
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

async function paint(b: Book, page: number, images = new Map()) {
  const { ctx, calls } = recorder()
  await paintPage(ctx, b, page, images, 2)
  return calls
}

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
  })
})

describe('paintPage', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts')
  })

  it('rejects pages the book does not have', async () => {
    for (const page of [0, 1.5, 5]) {
      await expect(paint(book(), page)).rejects.toThrow(RangeError)
    }
  })

  it('fills the page colour clipped to the page, paper by default', async () => {
    const calls = await paint(book(), 1)
    expect(of(calls, 'rect')[0]).toEqual(['rect', 0, 0, 200, 400])
    expect(of(calls, 'fillRect')[0]).toEqual([
      'fillRect',
      '#ffffff',
      0,
      0,
      200,
      400,
    ])
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
    const drawn = of(calls, 'drawImage')[0] ?? []
    expect(drawn[2]).toBe('brightness(1.1) contrast(1) saturate(0.5)')
    // Turned image box (`turnedPhotoStyle`), drawn unsnapped about the centre.
    expect(drawn.slice(-4)).toEqual([-90, -60, 180, 120])
  })

  it('snaps an untransformed photo to device pixels, as Chromium does', async () => {
    const at = (rotationDeg: number) =>
      paint(
        book({
          s1: [
            photo({
              rotationDeg,
              rect: { x: 10.3, y: 20, width: 30, height: 20 },
            }),
          ],
        }),
        2,
        new Map([['a', image(300, 200)]]),
      )
    const [left, top, width, height] = (
      of(await at(0), 'drawImage')[0] ?? []
    ).slice(-4) as number[]
    // Frame centre at x 50.6 px: the left edge rounds from 20.6 to 21 px.
    expect(left).toBeCloseTo(-29.6)
    expect([top, width, height]).toEqual([-20, 60, 40])
    expect((of(await at(5), 'drawImage')[0] ?? []).slice(-4)).toEqual([
      -30, -20, 60, 40,
    ])
  })

  it('paints only paper for a frame whose photo is not loaded', async () => {
    const calls = await paint(book({ s1: [photo()] }), 2)
    expect(of(calls, 'drawImage')).toEqual([])
    expect(of(calls, 'fill')).toEqual([['fill', '#ffffff']])
  })

  it('paints the stroke ring, then the mat ring, then the rounded body', async () => {
    const styled = makeBook({
      ...book({ s1: [photo({ frameStyleId: 'look' })] }),
      frameStyles: {
        look: {
          strokeMm: 1,
          strokeColor: '#111111',
          matMm: 2,
          matColor: '#eeeeee',
          cornerRadiusMm: 3,
        },
      },
    })
    const calls = await paint(styled, 2)
    expect(of(calls, 'roundRect')).toEqual([
      ['roundRect', -6, -6, 72, 52, 12],
      ['roundRect', -4, -4, 68, 48, 10],
      ['roundRect', -0, -0, 60, 40, 6],
    ])
    expect(of(calls, 'fill').map((c) => c[1])).toEqual([
      '#111111',
      '#eeeeee',
      '#ffffff',
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
    const calls = await paint(
      book({
        s1: [
          text('one two three four five', {
            align: 'center',
            rect: { x: 0, y: 0, width: 20, height: 11 },
          }),
        ],
      }),
      2,
    )
    // Body 3.6 mm × 2 = 7.2 px, 1.5 line height: two 10.8 px lines in 22 px.
    const lines = of(calls, 'fillText')
    expect(lines.map((c) => c.slice(1, 3))).toEqual([
      ['one two', 20],
      ['three four', 20],
    ])
    expect(lines[0]?.[4]).toBe(
      "400 7.2px 'Inter Variable', system-ui, sans-serif",
    )
    expect(lines[0]?.[5]).toBe('#232220')
    expect(Number(lines[1]?.[3]) - Number(lines[0]?.[3])).toBeCloseTo(10.8)
  })

  it('cuts a long caption with an ellipsis under the frame', async () => {
    const calls = await paint(
      book({ s1: [photo({ caption: 'A caption far wider than its frame' })] }),
      2,
    )
    const [, line, x, y, font, colour] = of(calls, 'fillText')[0] ?? []
    // 3.1 mm × 2 = 6.2 px type, 3.1 px per char: 60 px holds 19 chars.
    expect(line).toBe('A caption far wide…')
    expect(x).toBe(0)
    expect(Number(y)).toBeGreaterThan(40 + 3)
    expect(font).toBe("400 6.2px 'Inter Variable', Inter, sans-serif")
    expect(colour).toBe('#535152')
  })

  it('aligns a folio in its box in the ink colour', async () => {
    const numbered = setParentPageNumbers(
      makeBook({
        ...book(),
        parents: [{ id: 'pA', name: 'A', frames: [], guides: [] }],
        defaultParentId: 'pA',
      }),
      'pA',
      'outer',
    )
    const folio = async (page: number) =>
      of(await paint(numbered, page), 'fillText').find(
        (call) => call[1] === String(page),
      )
    const right = await folio(3)
    expect(right?.[5]).toBe('#232220')
    const left = await folio(2)
    expect(Number(right?.[2])).toBeGreaterThan(200)
    expect(Number(left?.[2])).toBeLessThan(200)
  })

  it('loads the fonts for the page text before painting', async () => {
    const loads: [string, string | undefined][] = []
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: (font: string, sample?: string) => {
          loads.push([font, sample])
          return Promise.resolve([])
        },
      },
    })
    await paint(book({ s1: [photo({ caption: 'Hi' }), text('Yo')] }), 2)
    expect(loads.length).toBeGreaterThan(0)
    expect(
      loads.every(([, sample]) => sample === 'Hi' + 'Yo' || sample === 'YoHi'),
    ).toBe(true)
  })
})

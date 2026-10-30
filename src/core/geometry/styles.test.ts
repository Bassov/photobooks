import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { bookSchema, parseBook, resolveSpread, serializeBook } from '../index'
import type { FrameStyle } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const hexArb = fc
  .array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 })
  .map((rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`)
const mmArb = fc.double({ min: 0, max: 50, noNaN: true })
const styleArb: fc.Arbitrary<FrameStyle> = fc.record(
  {
    strokeMm: mmArb,
    strokeColor: hexArb,
    matMm: mmArb,
    matColor: hexArb,
    cornerRadiusMm: mmArb,
  },
  { requiredKeys: [] },
)

function styledBook(style: FrameStyle, backgroundColor?: string) {
  return makeBook({
    frameStyles: { s: style },
    spreads: [
      makeSpread({
        ...(backgroundColor === undefined ? {} : { backgroundColor }),
        frames: [
          makeFrame({ id: 'styled', frameStyleId: 's' }),
          makeFrame({ id: 'plain', z: 1 }),
        ],
      }),
    ],
  })
}

describe('resolveSpread styles', () => {
  it('defaults unset style fields and omits unset colors', () => {
    const resolved = resolveSpread(styledBook({ strokeMm: 2 }), 'spread-1')
    expect(resolved?.items[0]?.style).toEqual({
      strokeMm: 2,
      matMm: 0,
      cornerRadiusMm: 0,
    })
  })

  it('carries both colors and every size of a full style', () => {
    const style = {
      strokeMm: 1,
      strokeColor: '#232223',
      matMm: 3,
      matColor: '#ffffff',
      cornerRadiusMm: 2,
    }
    const resolved = resolveSpread(styledBook(style), 'spread-1')
    expect(resolved?.items[0]?.style).toEqual(style)
  })

  it('carries only the colors that are set', () => {
    const stroke = resolveSpread(
      styledBook({ strokeColor: '#000000' }),
      'spread-1',
    )
    expect(stroke?.items[0]?.style).toEqual({
      strokeMm: 0,
      strokeColor: '#000000',
      matMm: 0,
      cornerRadiusMm: 0,
    })
    const mat = resolveSpread(styledBook({ matColor: '#ffffff' }), 'spread-1')
    expect(mat?.items[0]?.style).toEqual({
      strokeMm: 0,
      matMm: 0,
      matColor: '#ffffff',
      cornerRadiusMm: 0,
    })
  })

  it('does not look up a style for a frame without styleId', () => {
    const book = makeBook({
      frameStyles: { undefined: { strokeMm: 9 } },
      spreads: [makeSpread({ frames: [makeFrame()] })],
    })
    expect(resolveSpread(book, 'spread-1')?.items[0]).not.toHaveProperty(
      'style',
    )
  })

  it('leaves unstyled frames and a missing background untouched', () => {
    const resolved = resolveSpread(styledBook({ strokeMm: 2 }), 'spread-1')
    expect(resolved?.items[1]).not.toHaveProperty('style')
    expect(resolved).not.toHaveProperty('backgroundColor')
  })

  it('carries the spread background color', () => {
    const resolved = resolveSpread(styledBook({}, '#d7d7d7'), 'spread-1')
    expect(resolved?.backgroundColor).toBe('#d7d7d7')
  })

  it('re-resolves when only the style definition changes', () => {
    const book = styledBook({ strokeMm: 1 })
    const first = resolveSpread(book, 'spread-1')
    const next = { ...book, frameStyles: { s: { strokeMm: 4 } } }
    const second = resolveSpread(next, 'spread-1')
    expect(first?.items[0]?.style?.strokeMm).toBe(1)
    expect(second?.items[0]?.style?.strokeMm).toBe(4)
  })

  it('ignores a dangling styleId instead of throwing', () => {
    const book = makeBook({
      spreads: [makeSpread({ frames: [makeFrame({ frameStyleId: 'gone' })] })],
    })
    expect(resolveSpread(book, 'spread-1')?.items[0]).not.toHaveProperty(
      'style',
    )
  })

  test.prop([styleArb, fc.option(hexArb, { nil: undefined })])(
    'applies exactly the stored style to styled frames only',
    (style, background) => {
      const resolved = resolveSpread(styledBook(style, background), 'spread-1')
      assert.ok(resolved)
      expect(resolved.items[0]?.style).toEqual({
        strokeMm: style.strokeMm ?? 0,
        matMm: style.matMm ?? 0,
        cornerRadiusMm: style.cornerRadiusMm ?? 0,
        ...(style.strokeColor === undefined
          ? {}
          : { strokeColor: style.strokeColor }),
        ...(style.matColor === undefined ? {} : { matColor: style.matColor }),
      })
      expect(resolved.items[1]).not.toHaveProperty('style')
      expect(resolved.backgroundColor).toBe(background)
    },
  )
})

describe('style schema', () => {
  it.each(['#FFFFFF', '#fff', 'red', 'rgb(0,0,0)', '#12345g', ''])(
    'rejects non-lowercase-#rrggbb color %j',
    (color) => {
      const bad = styledBook({ strokeColor: color })
      expect(bookSchema.safeParse(bad).success).toBe(false)
      expect(bookSchema.safeParse(styledBook({}, color)).success).toBe(false)
    },
  )

  it.each(['#000000', '#0a1b2c', '#ffffff', '#d7d7d7'])(
    'accepts lowercase #rrggbb color %s',
    (color) => {
      expect(
        bookSchema.safeParse(styledBook({ strokeColor: color })).success,
      ).toBe(true)
      expect(bookSchema.safeParse(styledBook({}, color)).success).toBe(true)
    },
  )

  it.each(['#12345', '#1234567', 'x#123456', '#123456x', '#12345g'])(
    'rejects wrong-length or padded color %j',
    (color) => {
      expect(
        bookSchema.safeParse(styledBook({ matColor: color })).success,
      ).toBe(false)
    },
  )

  it('rejects negative style sizes', () => {
    for (const style of [
      { strokeMm: -1 },
      { matMm: -1 },
      { cornerRadiusMm: -1 },
    ]) {
      expect(bookSchema.safeParse(styledBook(style)).success).toBe(false)
    }
  })

  test.prop([styleArb, fc.option(hexArb, { nil: undefined })])(
    'styled books round-trip through serialize and parse',
    (style, background) => {
      const book = styledBook(style, background)
      const result = parseBook(serializeBook(book))
      assert.equal(result.ok, true)
      expect(result.book).toEqual(book)
    },
  )
})

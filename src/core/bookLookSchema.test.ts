import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { bookSchema, migrateToCurrent, parseBook, resolveSpread } from './index'
import { defaultCoverStyle } from './cover'
import {
  frameStyleName,
  frameStylePresets,
  noAdjust,
  newFrameStyleFromFrame,
  setFrameAdjust,
} from './ops/frameLook'
import { setTrim } from './ops/bookSettings'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

const withFrame = (patch: Record<string, unknown>) =>
  makeBook({
    assets: { a: {} },
    gallery: ['a'],
    spreads: [
      makeSpread({ frames: [{ ...makeFrame({ assetId: 'a' }), ...patch }] }),
    ],
  })

describe('schema v9 frame look', () => {
  it('accepts a caption and an adjust in range', () => {
    const book = withFrame({
      caption: 'Sea',
      adjust: { brightness: -100, contrast: 100, saturation: 0 },
    })
    const parsed = bookSchema.safeParse(book)
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty caption and out-of-range or fractional adjust', () => {
    const bad = (patch: Record<string, unknown>) =>
      bookSchema.safeParse(withFrame(patch)).success
    expect(bad({ caption: '' })).toBe(false)
    expect(
      bad({ adjust: { brightness: 101, contrast: 0, saturation: 0 } }),
    ).toBe(false)
    expect(
      bad({ adjust: { brightness: 0, contrast: -101, saturation: 0 } }),
    ).toBe(false)
    expect(
      bad({ adjust: { brightness: 0, contrast: 0, saturation: 0.5 } }),
    ).toBe(false)
    expect(bad({ adjust: { brightness: 0, contrast: 0 } })).toBe(false)
    expect(
      bad({ adjust: { brightness: 100, contrast: 0, saturation: -100 } }),
    ).toBe(true)
  })

  it('requires endpaper switches in settings and a long caption passes', () => {
    const book = makeBook()
    const settings = Object.fromEntries(
      Object.entries(book.settings).filter(([key]) => key !== 'endpapers'),
    )
    expect(bookSchema.safeParse({ ...book, settings }).success).toBe(false)
    expect(
      bookSchema.safeParse({
        ...book,
        settings: { ...book.settings, endpapers: { enabled: true } },
      }).success,
    ).toBe(false)
    expect(
      bookSchema.safeParse(withFrame({ caption: 'A long caption' })).success,
    ).toBe(true)
  })
})

describe('v8 to v9 migration shapes', () => {
  const v8 = (patch: Record<string, unknown>) => {
    const doc: Record<string, unknown> = {
      ...makeBook(),
      schemaVersion: 8,
      ...patch,
    }
    return doc
  }

  it('tolerates a non-object cover or settings (parse then rejects it)', () => {
    for (const patch of [{ cover: 'x' }, { settings: null }, { cover: null }]) {
      const result = migrateToCurrent(v8(patch))
      assert.equal(result.ok, true)
      expect(parseBook(v8(patch)).ok).toBe(false)
    }
  })

  it('adds the kit cover style and endpaper switches to a real v8 book', () => {
    const input = v8({})
    const result = migrateToCurrent(input)
    assert.equal(result.ok, true)
    const value = result.value as ReturnType<typeof makeBook>
    expect(value.schemaVersion).toBe(9)
    expect(value.cover.style).toEqual(defaultCoverStyle())
    expect(value.settings.endpapers).toEqual({ enabled: true, same: true })
    expect(value.settings.trim).toEqual(makeBook().settings.trim)
  })
})

describe('resolveSpread carries the frame look', () => {
  it('passes caption and adjust through, and omits them when absent', () => {
    const adjust = { brightness: 5, contrast: -5, saturation: 10 }
    const resolved = resolveSpread(
      withFrame({ caption: 'Sea', adjust }),
      'spread-1',
    )
    expect(resolved?.items[0]?.caption).toBe('Sea')
    expect(resolved?.items[0]?.adjust).toEqual(adjust)
    const plain = resolveSpread(withFrame({}), 'spread-1')
    expect(plain?.items[0]).not.toHaveProperty('caption')
    expect(plain?.items[0]).not.toHaveProperty('adjust')
  })

  it('falls back to the book page colour, spread colour wins', () => {
    const book = makeBook({ settings: { pageColor: '#f4f1ea' } })
    expect(resolveSpread(book, 'spread-1')?.backgroundColor).toBe('#f4f1ea')
    const own = makeBook({
      settings: { pageColor: '#f4f1ea' },
      spreads: [makeSpread({ backgroundColor: '#000000' })],
    })
    expect(resolveSpread(own, 'spread-1')?.backgroundColor).toBe('#000000')
    expect(resolveSpread(makeBook(), 'spread-1')).not.toHaveProperty(
      'backgroundColor',
    )
  })
})

describe('frame look details', () => {
  it('lists the kit presets exactly', () => {
    expect(frameStylePresets()).toEqual([
      {
        id: 'white-mat',
        name: 'White mat',
        style: { matMm: 3, matColor: '#ffffff' },
      },
      {
        id: 'hairline',
        name: 'Hairline',
        style: { strokeMm: 0.3, strokeColor: '#1c1b1a' },
      },
      {
        id: 'soft-corners',
        name: 'Soft corners',
        style: { cornerRadiusMm: 4 },
      },
    ])
    expect(noAdjust()).toEqual({ brightness: 0, contrast: 0, saturation: 0 })
  })

  it('names numbered styles by their number only', () => {
    expect(frameStyleName('x-style-4')).toBe('Style x-style-4')
    expect(frameStyleName('style-12')).toBe('Style 12')
  })

  it('a saturation-only change is a change', () => {
    const book = withFrame({
      adjust: { brightness: 3, contrast: 4, saturation: 5 },
    })
    const next = setFrameAdjust(book, 'spread-1', 'frame-1', { saturation: 6 })
    expect(next).not.toBe(book)
    expect(next.spreads[0]?.frames[0]?.adjust).toEqual({
      brightness: 3,
      contrast: 4,
      saturation: 6,
    })
  })

  it('skips taken style numbers', () => {
    const book = makeBook({
      frameStyles: { 'style-2': { matMm: 1 } },
      assets: { a: {} },
      gallery: ['a'],
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'a' })] })],
    })
    const next = newFrameStyleFromFrame(book, 'spread-1', 'frame-1')
    expect(next.spreads[0]?.frames[0]?.frameStyleId).toBe('style-3')
    expect(next.frameStyles['style-2']).toEqual({ matMm: 1 })
    expect(next.frameStyles['style-3']).toEqual({})
  })
})

describe('setTrim details', () => {
  it('rounds scaled frames to 0.1 mm and a height-only change applies', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ rect: { x: 10, y: 10, width: 100, height: 100 } }),
          ],
        }),
      ],
    })
    const next = setTrim(book, { widthMm: 200, heightMm: 300 })
    expect(next.spreads[0]?.frames[0]?.rect).toEqual({
      x: 6.7,
      y: 10,
      width: 66.7,
      height: 100,
    })
    const taller = setTrim(book, { widthMm: 300, heightMm: 400 })
    expect(taller).not.toBe(book)
    expect(taller.settings.trim.heightMm).toBe(400)
  })
})

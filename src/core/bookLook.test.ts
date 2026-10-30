import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants } from './index'
import {
  setCoverStyle,
  setEndpaperPhoto,
  setEndpapersEnabled,
  setEndpapersSame,
  setPageColor,
} from './cover'
import { TRIM_MAX_MM, TRIM_MIN_MM, setTrim } from './ops/bookSettings'
import {
  frameStylePresets,
  noAdjust,
  applyFrameStyle,
  editFrameStyle,
  frameStyleName,
  isAdjusted,
  newFrameStyleFromFrame,
  setFrameAdjust,
  setFrameCaption,
} from './ops/frameLook'
import { omitKey } from './omitKey'
import { SPINE_WIDTH_MAX_MM, SPINE_WIDTH_MIN_MM } from './schema'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from './testing/fixtures'

const frameOf = (book: ReturnType<typeof makeBook>) => {
  const frame = book.spreads[0]?.frames[0]
  if (frame === undefined) {
    throw new Error('no frame')
  }
  return frame
}

describe('omitKey', () => {
  it('drops one key and keeps the rest', () => {
    expect(omitKey({ a: 1, b: 2 }, 'a')).toEqual({ b: 2 })
    expect('a' in omitKey({ a: 1, b: 2 }, 'a')).toBe(false)
  })
})

describe('setCoverStyle', () => {
  it('merges the patch and keeps the rest', () => {
    const book = makeBook()
    const next = setCoverStyle(book, { titleFont: 'sans', finish: 'gloss' })
    expect(next.cover.style).toEqual({
      ...book.cover.style,
      titleFont: 'sans',
      finish: 'gloss',
    })
  })

  it('returns the same book when nothing changes', () => {
    const book = makeBook()
    expect(setCoverStyle(book, {})).toBe(book)
    expect(setCoverStyle(book, { material: book.cover.style.material })).toBe(
      book,
    )
  })

  it('clamps the spine width to its limits', () => {
    const book = makeBook()
    expect(
      setCoverStyle(book, { spineWidthMm: 999 }).cover.style.spineWidthMm,
    ).toBe(SPINE_WIDTH_MAX_MM)
    expect(
      setCoverStyle(book, { spineWidthMm: 0 }).cover.style.spineWidthMm,
    ).toBe(SPINE_WIDTH_MIN_MM)
    expect(
      setCoverStyle(book, { spineWidthMm: 20 }).cover.style.spineWidthMm,
    ).toBe(20)
  })
})

describe('endpapers', () => {
  it('puts a gallery photo on both sides while "same" is on', () => {
    const book = makeBookWithAsset('a1', { place: false })
    const next = setEndpaperPhoto(book, 'front', 'a1')
    expect(next.endpapers.front.assetId).toBe('a1')
    expect(next.endpapers.back.assetId).toBe('a1')
    expect(next.endpapers.front.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
    })
    expect(checkBookInvariants(next).ok).toBe(true)
    expect(setEndpaperPhoto(next, 'front', 'a1')).toBe(next)
  })

  it('touches only the picked side when "same" is off', () => {
    const base = makeBookWithAsset('a1', { place: false })
    const book = setEndpapersSame(base, false)
    const next = setEndpaperPhoto(book, 'back', 'a1')
    expect(next.endpapers.back.assetId).toBe('a1')
    expect(next.endpapers.front.assetId).toBeUndefined()
    const cleared = setEndpaperPhoto(next, 'back', undefined)
    expect(cleared.endpapers.back).toEqual({})
  })

  it('ignores an unknown or ungalleried asset', () => {
    const book = makeBook({ assets: { a2: {} } })
    expect(setEndpaperPhoto(book, 'front', 'nope')).toBe(book)
    expect(setEndpaperPhoto(book, 'front', 'a2')).toBe(book)
  })

  it('toggles the switch, and no change returns the same book', () => {
    const book = makeBook()
    expect(setEndpapersEnabled(book, true)).toBe(book)
    const off = setEndpapersEnabled(book, false)
    expect(off.settings.endpapers).toEqual({ enabled: false, same: true })
  })

  it('"same" on copies the front to the back', () => {
    const base = makeBookWithAsset('a1', { place: false })
    const split = setEndpaperPhoto(setEndpapersSame(base, false), 'front', 'a1')
    expect(split.endpapers.back.assetId).toBeUndefined()
    const same = setEndpapersSame(split, true)
    expect(same.endpapers.back).toEqual(split.endpapers.front)
    expect(setEndpapersSame(same, true)).toBe(same)
    const off = setEndpapersSame(same, false)
    expect(off.endpapers).toBe(same.endpapers)
    expect(off.settings.endpapers.same).toBe(false)
  })
})

describe('setPageColor', () => {
  it('sets and clears the book default colour', () => {
    const book = makeBook()
    const tinted = setPageColor(book, '#f4f1ea')
    expect(tinted.settings.pageColor).toBe('#f4f1ea')
    expect(setPageColor(tinted, '#f4f1ea')).toBe(tinted)
    const cleared = setPageColor(tinted, undefined)
    expect('pageColor' in cleared.settings).toBe(false)
    expect(setPageColor(book, undefined)).toBe(book)
  })
})

describe('setTrim', () => {
  it('scales frames and guides with the page', () => {
    const book = makeBook({
      guides: [{ id: 'g', orientation: 'vertical', offsetMm: 100 }],
      spreads: [
        makeSpread({
          guides: [{ id: 'h', orientation: 'horizontal', offsetMm: 60 }],
          frames: [
            makeFrame({ rect: { x: 30, y: 60, width: 90, height: 120 } }),
          ],
        }),
      ],
    })
    const next = setTrim(book, { widthMm: 150, heightMm: 600 })
    expect(next.settings.trim).toEqual({ widthMm: 150, heightMm: 500 })
    expect(frameOf(next).rect).toEqual({
      x: 15,
      y: 100,
      width: 45,
      height: 200,
    })
    expect(next.guides[0]?.offsetMm).toBe(50)
    expect(next.spreads[0]?.guides?.[0]?.offsetMm).toBe(100)
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('clamps to the limits, rounds to 0.1 mm, ignores non-finite and no-ops', () => {
    const book = makeBook()
    expect(setTrim(book, { widthMm: 1, heightMm: 300 }).settings.trim).toEqual({
      widthMm: TRIM_MIN_MM,
      heightMm: 300,
    })
    expect(setTrim(book, { widthMm: 300.04, heightMm: 300 })).toBe(book)
    expect(
      setTrim(book, { widthMm: 123.46, heightMm: TRIM_MAX_MM + 1 }).settings
        .trim,
    ).toEqual({ widthMm: 123.5, heightMm: TRIM_MAX_MM })
    expect(setTrim(book, { widthMm: Number.NaN, heightMm: 300 })).toBe(book)
    expect(setTrim(book, { widthMm: 300, heightMm: Infinity })).toBe(book)
    expect(setTrim(book, { widthMm: 300, heightMm: 300 })).toBe(book)
  })

  it('keeps frames at least 0.1 mm wide and skips spreads without guides', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ rect: { x: 0, y: 0, width: 0.1, height: 0.1 } }),
          ],
        }),
      ],
    })
    const next = setTrim(book, { widthMm: 50, heightMm: 50 })
    expect(frameOf(next).rect.width).toBeGreaterThanOrEqual(0.1)
    expect(next.spreads[0]?.guides).toBeUndefined()
  })
})

describe('frame caption and adjust', () => {
  const book = () =>
    makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ assetId: 'a' }),
            makeFrame({ id: 'frame-t', kind: 'text' }),
          ],
        }),
      ],
    })

  it('sets and clears a caption; empty clears; same returns the book', () => {
    const b = book()
    const set = setFrameCaption(b, 'spread-1', 'frame-1', 'Sea')
    expect(frameOf(set).caption).toBe('Sea')
    expect(setFrameCaption(set, 'spread-1', 'frame-1', 'Sea')).toBe(set)
    const cleared = setFrameCaption(set, 'spread-1', 'frame-1', '')
    expect('caption' in frameOf(cleared)).toBe(false)
    expect(setFrameCaption(b, 'spread-1', 'frame-1', '')).toBe(b)
  })

  it('ignores text frames', () => {
    const b = book()
    expect(setFrameCaption(b, 'spread-1', 'frame-t', 'x')).toBe(b)
    expect(setFrameAdjust(b, 'spread-1', 'frame-t', { contrast: 5 })).toBe(b)
  })

  it('merges adjust patches, drops all-zero, and resets with null', () => {
    const b = book()
    const one = setFrameAdjust(b, 'spread-1', 'frame-1', { brightness: 20 })
    expect(frameOf(one).adjust).toEqual({ ...noAdjust(), brightness: 20 })
    const two = setFrameAdjust(one, 'spread-1', 'frame-1', { contrast: -5 })
    expect(frameOf(two).adjust).toEqual({
      brightness: 20,
      contrast: -5,
      saturation: 0,
    })
    expect(setFrameAdjust(two, 'spread-1', 'frame-1', { contrast: -5 })).toBe(
      two,
    )
    const zeroed = setFrameAdjust(one, 'spread-1', 'frame-1', {
      brightness: 0,
    })
    expect('adjust' in frameOf(zeroed)).toBe(false)
    const reset = setFrameAdjust(two, 'spread-1', 'frame-1', null)
    expect('adjust' in frameOf(reset)).toBe(false)
    expect(setFrameAdjust(b, 'spread-1', 'frame-1', null)).toBe(b)
    expect(checkBookInvariants(two).ok).toBe(true)
  })

  it('clamps adjust to −100…100 whole numbers', () => {
    const next = setFrameAdjust(book(), 'spread-1', 'frame-1', {
      brightness: 250,
      contrast: -250,
      saturation: 10.6,
    })
    expect(frameOf(next).adjust).toEqual({
      brightness: 100,
      contrast: -100,
      saturation: 11,
    })
  })

  it('isAdjusted tells touched from untouched', () => {
    expect(isAdjusted(undefined)).toBe(false)
    expect(isAdjusted(noAdjust())).toBe(false)
    expect(isAdjusted({ ...noAdjust(), brightness: 1 })).toBe(true)
    expect(isAdjusted({ ...noAdjust(), contrast: 1 })).toBe(true)
    expect(isAdjusted({ ...noAdjust(), saturation: 1 })).toBe(true)
  })
})

describe('frame styles', () => {
  const book = () =>
    makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ assetId: 'a' }),
            makeFrame({ id: 'frame-2', assetId: 'a' }),
            makeFrame({ id: 'frame-t', kind: 'text' }),
          ],
        }),
      ],
    })

  it('applies a preset (adding it to the book) and clears it with undefined', () => {
    const b = book()
    const preset = { id: 'white-mat', style: { matMm: 3, matColor: '#ffffff' } }
    expect(frameStylePresets().find((p) => p.id === preset.id)?.style).toEqual(
      preset.style,
    )
    const applied = applyFrameStyle(b, 'spread-1', 'frame-1', preset.id)
    expect(frameOf(applied).frameStyleId).toBe(preset.id)
    expect(applied.frameStyles[preset.id]).toEqual(preset.style)
    expect(checkBookInvariants(applied).ok).toBe(true)
    expect(applyFrameStyle(applied, 'spread-1', 'frame-1', preset.id)).toBe(
      applied,
    )
    const none = applyFrameStyle(applied, 'spread-1', 'frame-1', undefined)
    expect('frameStyleId' in frameOf(none)).toBe(false)
    expect(applyFrameStyle(b, 'spread-1', 'frame-1', undefined)).toBe(b)
  })

  it('rejects unknown style keys and text frames', () => {
    const b = book()
    expect(applyFrameStyle(b, 'spread-1', 'frame-1', 'ghost')).toBe(b)
    const preset = frameStylePresets()[0]?.id ?? ''
    expect(
      applyFrameStyle(b, 'spread-1', 'frame-t', preset).spreads[0]?.frames[2]
        ?.frameStyleId,
    ).toBeUndefined()
  })

  it('edits a style in place for every frame using it', () => {
    const preset = frameStylePresets()[0]?.id ?? ''
    const applied = applyFrameStyle(book(), 'spread-1', 'frame-1', preset)
    const edited = editFrameStyle(applied, preset, { cornerRadiusMm: 3 })
    expect(edited.frameStyles[preset]?.cornerRadiusMm).toBe(3)
    expect(editFrameStyle(edited, preset, { cornerRadiusMm: 3 })).toBe(edited)
    expect(editFrameStyle(edited, 'ghost', { matMm: 1 })).toBe(edited)
  })

  it('copies the frame style into a new numbered style and applies it', () => {
    const preset = frameStylePresets()[0]?.id ?? ''
    const applied = applyFrameStyle(book(), 'spread-1', 'frame-1', preset)
    const next = newFrameStyleFromFrame(applied, 'spread-1', 'frame-1')
    expect(frameOf(next).frameStyleId).toBe('style-2')
    expect(next.frameStyles['style-2']).toEqual(applied.frameStyles[preset])
    const again = newFrameStyleFromFrame(next, 'spread-1', 'frame-2')
    expect(again.spreads[0]?.frames[1]?.frameStyleId).toBe('style-3')
    expect(again.frameStyles['style-3']).toEqual({})
    expect(newFrameStyleFromFrame(again, 'spread-1', 'frame-t')).toBe(again)
    expect(newFrameStyleFromFrame(again, 'spread-1', 'ghost')).toBe(again)
    expect(newFrameStyleFromFrame(again, 'ghost', 'frame-1')).toBe(again)
  })

  it('names presets and numbered styles', () => {
    expect(frameStyleName('white-mat')).toBe('White mat')
    expect(frameStyleName('style-4')).toBe('Style 4')
  })
})

describe('applyBookOp routes the new ops', () => {
  it('reaches every op through the reducer', () => {
    let book = makeBookWithAsset('a1', { place: true })
    const run = (op: Parameters<typeof applyBookOp>[1]) => {
      book = applyBookOp(book, op)
    }
    run({ type: 'setCoverStyle', patch: { finish: 'gloss' } })
    run({ type: 'setTrim', widthMm: 200, heightMm: 200 })
    run({ type: 'setEndpapersEnabled', enabled: false })
    run({ type: 'setEndpapersSame', same: false })
    run({ type: 'setEndpaperPhoto', side: 'front', assetId: 'a1' })
    run({ type: 'setPageColor', color: '#e6e6e6' })
    run({
      type: 'setFrameCaption',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      caption: 'c',
    })
    run({
      type: 'setFrameAdjust',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      patch: { contrast: 3 },
    })
    run({
      type: 'applyFrameStyle',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      styleId: 'hairline',
    })
    run({ type: 'editFrameStyle', styleId: 'hairline', patch: { matMm: 2 } })
    run({ type: 'newFrameStyle', spreadId: 'spread-1', frameId: 'frame-1' })
    expect(book.cover.style.finish).toBe('gloss')
    expect(book.settings.trim.widthMm).toBe(200)
    expect(book.settings.endpapers).toEqual({ enabled: false, same: false })
    expect(book.endpapers.front.assetId).toBe('a1')
    expect(book.settings.pageColor).toBe('#e6e6e6')
    expect(frameOf(book).caption).toBe('c')
    expect(frameOf(book).adjust?.contrast).toBe(3)
    expect(frameOf(book).frameStyleId).toBe('style-2')
    expect(book.frameStyles.hairline?.matMm).toBe(2)
    expect(checkBookInvariants(book).ok).toBe(true)
  })
})

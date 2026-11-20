import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Book, Frame } from '../schema'
import { makeBook, makeSpread } from '../testing/fixtures'
import { applyTemplate } from './apply'
import { generateTemplateFrames } from './catalog'
import { TEMPLATE_IDS, type FixedTemplateId } from './types'

const SPREAD_ID = 'spread-2'
const SPREAD_INDEX = 1

type Settings = Omit<Frame, 'id' | 'rect' | 'z' | 'rotationDeg'>

const SETTINGS: Settings = {
  assetId: 'a',
  crop: { zoom: 2, center: { x: 0.25, y: 0.75 } },
  fit: 'fit',
  adjust: { brightness: 10, contrast: -20, saturation: 30 },
  caption: 'At the lake',
  frameStyleId: 'thin',
  locked: true,
}

/** A three-spread book; the middle (two-page) spread is laid out by `templateId`. */
function laidBook(templateId: FixedTemplateId): Book {
  const book = makeBook({
    assets: { a: {} },
    gallery: ['a'],
    spreads: [
      makeSpread({ id: 'spread-1', frames: [] }),
      makeSpread({ id: SPREAD_ID, frames: [] }),
      makeSpread({ id: 'spread-3', frames: [] }),
    ],
  })
  return applyTemplate(book, SPREAD_ID, templateId)
}

function frames(book: Book): Frame[] {
  return book.spreads[SPREAD_INDEX]?.frames ?? []
}

function withFrames(book: Book, next: Frame[]): Book {
  return {
    ...book,
    spreads: book.spreads.map((spread, index) =>
      index === SPREAD_INDEX ? { ...spread, frames: next } : spread,
    ),
  }
}

function generated(book: Book, templateId: FixedTemplateId): Frame[] {
  const spread = book.spreads[SPREAD_INDEX]
  if (spread === undefined) {
    throw new Error('missing spread')
  }
  return generateTemplateFrames(templateId, book, SPREAD_INDEX, spread)
}

function nonEmpty(list: Frame[]): [Frame, ...Frame[]] {
  const [first, ...rest] = list
  if (first === undefined) {
    throw new Error('no frames')
  }
  return [first, ...rest]
}

describe('applyTemplate rebinds frames', () => {
  it.each(Object.keys(SETTINGS) as (keyof Settings)[])(
    'keeps %s of a moved frame',
    (key) => {
      // Arrange
      const before = laidBook('4-grid')
      const [first, ...rest] = nonEmpty(frames(before))
      const book = withFrames(before, [
        { ...first, [key]: SETTINGS[key] },
        ...rest,
      ])

      // Act
      const after = applyTemplate(book, SPREAD_ID, 'hero-grid')

      // Assert
      const target = generated(book, 'hero-grid')[0]
      expect(frames(after)[0]).toStrictEqual({
        id: first.id,
        rect: target?.rect,
        z: target?.z,
        [key]: SETTINGS[key],
      })
    },
  )

  it('keeps every setting together; rect, z and rotation come from the template', () => {
    // Arrange
    const before = laidBook('4-grid')
    const book = withFrames(
      before,
      frames(before).map((frame, index) => ({
        ...frame,
        ...SETTINGS,
        rect: { x: 1, y: 2, width: 3, height: 4 },
        z: 40 + index,
        rotationDeg: 15,
      })),
    )

    // Act
    const after = applyTemplate(book, SPREAD_ID, '4-grid')

    // Assert
    const targets = generated(book, '4-grid')
    expect(frames(after)).toStrictEqual(
      frames(before).map((frame, index) => ({
        ...SETTINGS,
        id: frame.id,
        rect: targets[index]?.rect,
        z: targets[index]?.z,
      })),
    )
  })

  it('resets rotation of a frame already on its template rect', () => {
    // Arrange
    const before = laidBook('2-up')
    const book = withFrames(
      before,
      frames(before).map((frame) => ({ ...frame, rotationDeg: 30 })),
    )

    // Act
    const after = applyTemplate(book, SPREAD_ID, '2-up')

    // Assert
    expect(frames(after)).toStrictEqual(frames(before))
  })

  it('keeps an unmoved, unrotated frame as the same object', () => {
    // Arrange
    const before = laidBook('2-up')
    const book = withFrames(
      before,
      frames(before).map((frame) => ({ ...frame, ...SETTINGS })),
    )

    // Act
    const after = applyTemplate(book, SPREAD_ID, '2-up')

    // Assert
    expect(after).toBe(book)
  })

  it('adds frames without a previous counterpart as generated', () => {
    // Arrange
    const before = laidBook('full-bleed')
    const book = withFrames(
      before,
      frames(before).map((frame) => ({ ...frame, ...SETTINGS })),
    )

    // Act
    const after = applyTemplate(book, SPREAD_ID, '4-grid')

    // Assert
    const targets = generated(book, '4-grid')
    expect(frames(after).slice(1)).toStrictEqual(targets.slice(1))
    expect(frames(after)[0]).toMatchObject(SETTINGS)
  })
})

const arbSettings: fc.Arbitrary<Settings> = fc.record(
  {
    assetId: fc.constant('a'),
    crop: fc.record({
      zoom: fc.double({ min: 1, max: 4, noNaN: true }),
      center: fc.record({
        x: fc.double({ min: 0, max: 1, noNaN: true }),
        y: fc.double({ min: 0, max: 1, noNaN: true }),
      }),
    }),
    fit: fc.constantFrom('fill' as const, 'fit' as const),
    adjust: fc.record({
      brightness: fc.integer({ min: -100, max: 100 }),
      contrast: fc.integer({ min: -100, max: 100 }),
      saturation: fc.integer({ min: -100, max: 100 }),
    }),
    caption: fc.string({ minLength: 1 }),
    frameStyleId: fc.string({ minLength: 1 }),
    locked: fc.boolean(),
  },
  { requiredKeys: [] },
)

describe('applyTemplate rebind (property)', () => {
  it('A → B → A keeps photo settings; geometry is the last template', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEMPLATE_IDS),
        fc.constantFrom(...TEMPLATE_IDS),
        fc.array(arbSettings, { minLength: 8, maxLength: 8 }),
        fc.array(fc.double({ min: -180, max: 180, noNaN: true }), {
          minLength: 8,
          maxLength: 8,
        }),
        (a, b, settings, rotations) => {
          const laid = laidBook(a)
          const book = withFrames(
            laid,
            frames(laid).map((frame, index) => ({
              ...frame,
              ...settings[index],
              rotationDeg: rotations[index],
            })),
          )

          const viaB = applyTemplate(book, SPREAD_ID, b)
          const back = applyTemplate(viaB, SPREAD_ID, a)

          const kept = Math.min(frames(book).length, frames(viaB).length)
          const targets = generated(back, a)
          expect(
            frames(back).map(({ rect, z, rotationDeg }) => ({
              rect,
              z,
              rotationDeg,
            })),
          ).toStrictEqual(
            targets.map(({ rect, z }) => ({ rect, z, rotationDeg: undefined })),
          )
          expect(frames(back).slice(0, kept)).toStrictEqual(
            frames(book)
              .slice(0, kept)
              .map((frame, index) => ({
                ...settings[index],
                id: frame.id,
                rect: targets[index]?.rect,
                z: targets[index]?.z,
              })),
          )
        },
      ),
    )
  })
})

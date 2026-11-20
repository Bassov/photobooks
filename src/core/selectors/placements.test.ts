import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { defaultCoverStyle } from '../cover'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import {
  bookHasAnyPlacement,
  placementCountByAsset,
  placementsOfAsset,
  unplacedAssetIds,
} from './placements'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

describe('placements on the cover and endpapers', () => {
  it('counts cover panels and endpapers like frames', () => {
    const book = makeBook({
      gallery: ['a', 'b', 'c'],
      spreads: [
        makeSpread({ frames: [makeFrame({ id: 'f0', assetId: 'a' })] }),
      ],
      cover: {
        front: { text: '', assetId: 'a' },
        spine: { text: '' },
        back: { text: '', assetId: 'b' },
        style: defaultCoverStyle(),
      },
      endpapers: { front: { assetId: 'c' }, back: {} },
    })
    const counts = placementCountByAsset(book)
    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
    expect(counts.get('c')).toBe(1)
    expect(unplacedAssetIds(book)).toEqual([])
  })

  it('counts the spine panel and back endpaper too', () => {
    const book = makeBook({
      gallery: ['a', 'b'],
      cover: {
        front: { text: '' },
        spine: { text: '', assetId: 'a' },
        back: { text: '' },
        style: defaultCoverStyle(),
      },
      endpapers: { front: {}, back: { assetId: 'b' } },
    })
    expect(placementCountByAsset(book).get('a')).toBe(1)
    expect(placementCountByAsset(book).get('b')).toBe(1)
  })

  it('keeps bookHasAnyPlacement about frames only', () => {
    const book = makeBook({
      gallery: ['a'],
      cover: {
        front: { text: '', assetId: 'a' },
        spine: { text: '' },
        back: { text: '' },
        style: defaultCoverStyle(),
      },
    })
    expect(bookHasAnyPlacement(book)).toBe(false)
  })
})

describe('bookHasAnyPlacement', () => {
  it('is false when no frame has an assetId', () => {
    const book = makeBook({
      gallery: ['a'],
      spreads: [makeSpread({ frames: [makeFrame({ id: 'f0' })] })],
    })
    expect(bookHasAnyPlacement(book)).toBe(false)
    expect(placementCountByAsset(book).size).toBe(0)
  })

  it('is true when any frame has an assetId even if others are empty', () => {
    const book = makeBook({
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'f0', assetId: 'a' }),
            makeFrame({ id: 'f1' }),
          ],
        }),
      ],
    })
    expect(bookHasAnyPlacement(book)).toBe(true)
  })
})

describe('placementsOfAsset', () => {
  it('lists places in spread-list order, frames bottom to top', () => {
    const book = makeBook({
      gallery: ['a', 'b'],
      spreads: [
        makeSpread({
          id: 's0',
          frames: [
            makeFrame({ id: 'top', assetId: 'a', z: 2 }),
            makeFrame({ id: 'bottom', assetId: 'a', z: 0 }),
            makeFrame({ id: 'other', assetId: 'b', z: 1 }),
          ],
          parentOverrides: {
            frames: [
              {
                ...makeFrame({ id: 'copy', assetId: 'a', z: 1 }),
                overridesId: 'p0',
              },
            ],
          },
        }),
        makeSpread({
          id: 's1',
          frames: [makeFrame({ id: 'f0', assetId: 'a' })],
        }),
      ],
      cover: {
        front: { text: '', assetId: 'a' },
        spine: { text: '', assetId: 'a' },
        back: { text: '', assetId: 'a' },
        style: defaultCoverStyle(),
      },
      endpapers: { front: { assetId: 'a' }, back: { assetId: 'a' } },
    })
    expect(placementsOfAsset(book, 'a')).toEqual([
      { kind: 'cover', panel: 'front' },
      { kind: 'cover', panel: 'spine' },
      { kind: 'cover', panel: 'back' },
      { kind: 'endpaper', side: 'front' },
      { kind: 'frame', spreadId: 's0', frameId: 'bottom' },
      { kind: 'frame', spreadId: 's0', frameId: 'copy' },
      { kind: 'frame', spreadId: 's0', frameId: 'top' },
      { kind: 'frame', spreadId: 's1', frameId: 'f0' },
      { kind: 'endpaper', side: 'back' },
    ])
    expect(placementsOfAsset(book, 'b')).toEqual([
      { kind: 'frame', spreadId: 's0', frameId: 'other' },
    ])
  })

  it('keeps own frames before copies at equal z', () => {
    const book = makeBook({
      gallery: ['a'],
      spreads: [
        makeSpread({
          id: 's0',
          frames: [makeFrame({ id: 'own', assetId: 'a', z: 0 })],
          parentOverrides: {
            frames: [
              {
                ...makeFrame({ id: 'copy', assetId: 'a', z: 0 }),
                overridesId: 'p0',
              },
            ],
          },
        }),
      ],
    })
    expect(
      placementsOfAsset(book, 'a').map((p) => p.kind === 'frame' && p.frameId),
    ).toEqual(['own', 'copy'])
  })

  it('is empty for an unplaced asset', () => {
    const book = makeBook({
      gallery: ['a', 'b'],
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'a' })] })],
    })
    expect(placementsOfAsset(book, 'b')).toEqual([])
  })
})

const ASSETS = ['a', 'b', 'c'] as const
const assetArb = fc.option(fc.constantFrom(...ASSETS), { nil: undefined })
const frameArb = fc.record({
  z: fc.integer({ min: 0, max: 3 }),
  assetId: assetArb,
})
const slotArb = fc.record({ assetId: assetArb })

const bookArb = fc
  .record({
    spreads: fc.array(
      fc.record({
        own: fc.array(frameArb, { maxLength: 4 }),
        copies: fc.array(frameArb, { maxLength: 2 }),
      }),
      { maxLength: 4 },
    ),
    cover: fc.tuple(slotArb, slotArb, slotArb),
    endpapers: fc.tuple(slotArb, slotArb),
  })
  .map((g) =>
    makeBook({
      gallery: [...ASSETS],
      spreads: g.spreads.map((s, i) =>
        makeSpread({
          id: `s${String(i)}`,
          frames: s.own.map((f, j) => makeFrame({ id: `f${String(j)}`, ...f })),
          parentOverrides: {
            frames: s.copies.map((f, j) => ({
              ...makeFrame({ id: `c${String(j)}`, ...f }),
              overridesId: `p${String(j)}`,
            })),
          },
        }),
      ),
      cover: {
        front: { text: '', ...g.cover[0] },
        spine: { text: '', ...g.cover[1] },
        back: { text: '', ...g.cover[2] },
        style: defaultCoverStyle(),
      },
      endpapers: { front: g.endpapers[0], back: g.endpapers[1] },
    }),
  )

describe('placementsOfAsset (property)', () => {
  it('lists exactly as many places as placementCountByAsset counts', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const counts = placementCountByAsset(book)
        for (const assetId of [...ASSETS, 'missing']) {
          expect(placementsOfAsset(book, assetId)).toHaveLength(
            counts.get(assetId) ?? 0,
          )
        }
      }),
      runs,
    )
  })
})

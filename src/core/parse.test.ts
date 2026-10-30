import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { CURRENT_SCHEMA_VERSION, parseBook, serializeBook } from './index'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from './testing/fixtures'

describe('parseBook', () => {
  it('parses a valid book', () => {
    const result = parseBook(makeBookWithAsset())
    expect(result.ok).toBe(true)
  })

  it('rejects newer schemaVersion', () => {
    const result = parseBook({
      ...makeBook(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 5,
    })
    expect(result).toMatchObject({ ok: false, code: 'newer-schema' })
  })

  it('round-trips rotationDeg, locked and crop rotation', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              rotationDeg: -12.5,
              locked: true,
              crop: {
                zoom: 1,
                center: { x: 0.5, y: 0.5 },
                quarterTurns: 3,
                straightenDeg: 2.5,
              },
            }),
          ],
        }),
      ],
    })
    const parsed = parseBook(serializeBook(book))
    assert.equal(parsed.ok, true)
    expect(parsed.book).toEqual(book)
  })

  it.each([
    ['quarterTurns 4', { quarterTurns: 4 }],
    ['fractional quarterTurns', { quarterTurns: 1.5 }],
    ['straightenDeg out of range', { straightenDeg: 90 }],
  ])('rejects crop with %s', (_label, extra) => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, ...extra },
            }),
          ],
        }),
      ],
    })
    expect(parseBook(book)).toMatchObject({ ok: false })
  })

  describe('crop rotation bounds', () => {
    const parseCrop = (extra: Record<string, number>) =>
      parseBook(
        makeBook({
          spreads: [
            makeSpread({
              frames: [
                makeFrame({
                  crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, ...extra },
                }),
              ],
            }),
          ],
        }),
      )

    it.each([0, 1, 2, 3])('accepts quarterTurns %d', (quarterTurns) => {
      expect(parseCrop({ quarterTurns }).ok).toBe(true)
    })

    it.each([-1, 4, 0.5])('rejects quarterTurns %d', (quarterTurns) => {
      expect(parseCrop({ quarterTurns }).ok).toBe(false)
    })

    it.each([-45, -44.99, 0, 44.99, 45])(
      'accepts straightenDeg %d',
      (straightenDeg) => {
        expect(parseCrop({ straightenDeg }).ok).toBe(true)
      },
    )

    it.each([-45.01, 45.01])('rejects straightenDeg %d', (straightenDeg) => {
      expect(parseCrop({ straightenDeg }).ok).toBe(false)
    })
  })

  it('rejects non-numeric rotationDeg', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          frames: [makeFrame({ rotationDeg: Number.NaN })],
        }),
      ],
    })
    expect(parseBook(book)).toMatchObject({ ok: false })
  })

  it('rejects invalid shape', () => {
    const result = parseBook({ schemaVersion: CURRENT_SCHEMA_VERSION })
    expect(result).toMatchObject({ ok: false, code: 'invalid-shape' })
  })

  it('rejects invariant violations', () => {
    const result = parseBook(
      makeBook({
        assets: {},
        gallery: [],
        spreads: [makeSpread({ frames: [makeFrame({ assetId: 'x' })] })],
      }),
    )
    expect(result).toMatchObject({ ok: false, code: 'invariant' })
  })

  it('round-trips serialize then parse', () => {
    const book = makeBookWithAsset('photo-a')
    const result = parseBook(serializeBook(book))
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book).toEqual(book)
  })

  it('parses empty and full asset records', () => {
    const empty = parseBook(makeBookWithAsset('photo-a'))
    expect(empty.ok).toBe(true)
    assert.equal(empty.ok, true)
    expect(empty.book.assets['photo-a']).toEqual({})

    const record = {
      sourceRootId: 'root-1',
      relativePath: 'vacation/IMG_001.jpg',
      byteSize: 1024,
      mtimeMs: 1_700_000_000_000,
      contentHash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }
    const full = parseBook(
      makeBook({
        assets: { 'photo-a': record },
        gallery: ['photo-a'],
      }),
    )
    expect(full.ok).toBe(true)
    assert.equal(full.ok, true)
    expect(full.book.assets['photo-a']).toEqual(record)
  })

  it.each([
    [{ byteSize: -1 }],
    [{ byteSize: 1.5 }],
    [{ mtimeMs: Number.NaN }],
    [{ sourceRootId: '' }],
    [{ relativePath: '' }],
    [{ contentHash: '' }],
    [{ contentHash: 'abc123' }],
    [
      {
        contentHash:
          'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      },
    ],
  ])('rejects malformed asset field %j', (asset) => {
    expect(
      parseBook(
        makeBook({
          assets: { a: asset },
          gallery: ['a'],
        }),
      ),
    ).toMatchObject({ ok: false, code: 'invalid-shape' })
  })

  it('parses a migrated v1 book with empty assets', () => {
    const current = makeBookWithAsset('photo-a')
    const v1 = {
      schemaVersion: 1,
      id: current.id,
      settings: current.settings,
      layoutGrid: current.layoutGrid,
      guides: current.guides,
      assets: { 'photo-a': {} },
      gallery: current.gallery,
      spreads: current.spreads,
    }
    const result = parseBook(v1)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.book.title).toBe('')
    expect(result.book.assets['photo-a']).toEqual({})
  })

  it('parses a migrated v2 book preserving identity and defaulting title', () => {
    const identity = {
      sourceRootId: 'root-1',
      relativePath: 'a.jpg',
      byteSize: 10,
      mtimeMs: 100,
      contentHash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }
    const current = makeBook({
      assets: { 'photo-a': identity },
      gallery: ['photo-a'],
    })
    const v2 = {
      schemaVersion: 2,
      id: current.id,
      settings: current.settings,
      layoutGrid: current.layoutGrid,
      guides: current.guides,
      assets: current.assets,
      gallery: current.gallery,
      spreads: current.spreads,
    }
    const result = parseBook(v2)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.book.title).toBe('')
    expect(result.book.assets['photo-a']).toEqual(identity)
  })

  it('parses full asset metadata on the current schema', () => {
    const metaAsset = {
      widthPx: 100,
      heightPx: 200,
      orientation: 6,
      capturedAt: '2024-01-01T00:00:00Z',
      colorSpace: 'Display P3',
      iccProfileName: 'Display P3',
      mime: 'image/heic',
      meta: {
        title: 't',
        keywords: ['k'],
        gps: { lat: 1, lon: 2 },
      },
    }
    const result = parseBook(
      makeBook({
        title: 'Album',
        assets: { a: metaAsset },
        gallery: ['a'],
      }),
    )
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book.title).toBe('Album')
    expect(result.book.assets.a).toEqual(metaAsset)
  })

  it('rejects duplicate gallery ids at the schema boundary', () => {
    const result = parseBook(
      makeBook({
        assets: { a: {} },
        gallery: ['a', 'a'],
      }),
    )
    expect(result).toMatchObject({
      ok: false,
      code: 'invalid-shape',
      message: 'Gallery ids must be unique',
    })
  })
})

const assetIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,11}$/)
const mmArb = fc.double({ min: 0, max: 500, noNaN: true })
const positiveMmArb = fc.double({ min: 1, max: 500, noNaN: true })

test.prop(
  [
    assetIdArb,
    positiveMmArb,
    positiveMmArb,
    mmArb,
    fc.integer({ min: 1, max: 8 }),
    fc.integer({ min: 1, max: 8 }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'parse(serialize(book)) is lossless for generated valid books',
  (assetId, widthMm, heightMm, gutterMm, columns, rows) => {
    const book = makeBook({
      settings: { trim: { widthMm, heightMm }, bleedMm: 3, safeMarginMm: 5 },
      layoutGrid: {
        margins: { top: 10, bottom: 10, inside: 10, outside: 10 },
        columns,
        rows,
        columnGutterMm: gutterMm,
        rowGutterMm: gutterMm,
      },
      assets: { [assetId]: {} },
      gallery: [assetId],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              assetId,
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
            }),
          ],
        }),
      ],
    })

    const result = parseBook(serializeBook(book))
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book).toEqual(book)
  },
)

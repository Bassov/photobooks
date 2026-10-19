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
    const v1 = {
      ...makeBookWithAsset('photo-a'),
      schemaVersion: 1,
      assets: { 'photo-a': {} },
    }
    const result = parseBook(v1)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.book.assets['photo-a']).toEqual({})
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
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
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

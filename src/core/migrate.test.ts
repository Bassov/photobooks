import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  type Book,
  CURRENT_SCHEMA_VERSION,
  defaultCover,
  defaultEndpapers,
  migrateToCurrent,
  parseBook,
} from './index'
import { makeBook } from './testing/fixtures'

/** A pre-v5 document: the current fixture minus the v5 fields. */
function withoutCover(book: Book): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...book }
  delete doc.cover
  delete doc.endpapers
  return doc
}

describe('migrateToCurrent', () => {
  it('accepts current schemaVersion as identity', () => {
    const input = makeBook()
    const result = migrateToCurrent(input)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.value).toBe(input)
  })

  it('rejects newer schemaVersion', () => {
    const result = migrateToCurrent({
      ...makeBook(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    })
    expect(result).toEqual({
      ok: false,
      code: 'newer-schema',
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      supportedVersion: CURRENT_SCHEMA_VERSION,
    })
  })

  it('rejects missing schemaVersion', () => {
    const result = migrateToCurrent({ id: 'x' })
    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid-shape')
    expect(result.message).toContain('schemaVersion')
  })

  it('rejects null, arrays, and non-objects', () => {
    expect(migrateToCurrent(null)).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
    expect(migrateToCurrent([])).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
    expect(migrateToCurrent('book')).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
  })

  it('rejects non-numeric and sub-1 schemaVersion', () => {
    expect(migrateToCurrent({ schemaVersion: '1' })).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
    expect(migrateToCurrent({ schemaVersion: Number.NaN })).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
    expect(migrateToCurrent({ schemaVersion: 0 })).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
  })

  it('migrates v1 empty assets to v2 without inventing identity fields', () => {
    const base = makeBook()
    const v1 = {
      schemaVersion: 1,
      id: base.id,
      settings: base.settings,
      layoutGrid: base.layoutGrid,
      guides: base.guides,
      assets: { a: {}, b: { stray: true } },
      gallery: ['a', 'b'],
      spreads: base.spreads,
    }
    const result = migrateToCurrent(v1)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.value).toMatchObject({
      schemaVersion: 8,
      title: '',
      assets: { a: {}, b: {} },
      gallery: ['a', 'b'],
      id: v1.id,
    })
    const assets = (result.value as { assets: Record<string, unknown> }).assets
    expect(assets.a).toEqual({})
    expect(assets.b).toEqual({})
  })

  it('migrates v2 to v3 with empty title and preserved identity', () => {
    const identity = {
      sourceRootId: 'root-1',
      relativePath: 'a.jpg',
      byteSize: 10,
      mtimeMs: 100,
      contentHash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }
    const base = makeBook({ assets: { a: identity }, gallery: ['a'] })
    const v2 = {
      schemaVersion: 2,
      id: base.id,
      settings: base.settings,
      layoutGrid: base.layoutGrid,
      guides: base.guides,
      assets: base.assets,
      gallery: base.gallery,
      spreads: base.spreads,
    }
    const result = migrateToCurrent(v2)
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.value).toMatchObject({
      schemaVersion: 8,
      title: '',
      assets: { a: identity },
    })
    const asset = (result.value as { assets: Record<string, unknown> }).assets.a
    expect(asset).toEqual(identity)
    expect(asset).not.toHaveProperty('widthPx')
    expect(asset).not.toHaveProperty('meta')
  })

  it.each([
    ['missing', undefined],
    ['number', 1],
    ['null', null],
    ['object', {}],
  ] as const)(
    'v2→v3 defaults non-string title (%s) to empty string',
    (_label, title) => {
      const base = makeBook()
      const v2 = {
        schemaVersion: 2,
        id: base.id,
        settings: base.settings,
        layoutGrid: base.layoutGrid,
        guides: base.guides,
        assets: base.assets,
        gallery: base.gallery,
        spreads: base.spreads,
        ...(title === undefined ? {} : { title }),
      }
      const result = migrateToCurrent(v2)
      expect(result.ok).toBe(true)
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({ schemaVersion: 8, title: '' })
    },
  )

  it('preserves string title when migrating v2 to v3', () => {
    const result = migrateToCurrent({
      ...makeBook({ title: 'Summer' }),
      schemaVersion: 2,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.value).toMatchObject({ schemaVersion: 8, title: 'Summer' })
  })

  it('rejects non-finite schemaVersion', () => {
    for (const schemaVersion of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const result = migrateToCurrent({ schemaVersion })
      expect(result).toMatchObject({
        ok: false,
        code: 'invalid-shape',
      })
      expect(result).not.toMatchObject({ code: 'newer-schema' })
    }
  })

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'folder'],
    ['number', 1],
  ] as const)(
    'replaces non-object v1 assets (%s) with an empty map',
    (_label, assets) => {
      const result = migrateToCurrent({
        ...makeBook(),
        schemaVersion: 1,
        assets,
        gallery: [],
      })
      expect(result.ok).toBe(true)
      assert.equal(result.ok, true)
      expect(
        (result.value as { assets: Record<string, unknown> }).assets,
      ).toEqual({})
      expect(result.value).toMatchObject({ schemaVersion: 8, title: '' })
    },
  )

  describe('v3 to v4', () => {
    const v3Book = (frames: unknown[]) => ({
      ...makeBook(),
      schemaVersion: 3,
      spreads: [{ id: 's1', frames }],
    })
    const frameV3 = {
      id: 'f1',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      z: 0,
    }

    it('defaults rotationDeg to 0 and leaves frames unlocked', () => {
      const result = migrateToCurrent(v3Book([frameV3]))
      assert.equal(result.ok, true)
      const frame = (
        result.value as { spreads: { frames: Record<string, unknown>[] }[] }
      ).spreads[0]?.frames[0]
      expect(frame).toEqual({ ...frameV3, rotationDeg: 0, kind: 'image' })
      expect(frame).not.toHaveProperty('locked')
      expect(result.value).toMatchObject({ schemaVersion: 8 })
    })

    it('migrates a v3 book into a valid current book', () => {
      const result = parseBook(v3Book([frameV3]))
      assert.equal(result.ok, true)
      expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.book.spreads[0]?.frames[0]?.rotationDeg).toBe(0)
    })

    it('chains v1 through v8', () => {
      const result = migrateToCurrent({
        ...v3Book([frameV3]),
        schemaVersion: 1,
      })
      expect(result).toMatchObject({
        ok: true,
        value: { schemaVersion: 8 },
      })
    })

    it('keeps an existing rotationDeg and tolerates odd shapes', () => {
      const result = migrateToCurrent({
        ...makeBook(),
        schemaVersion: 3,
        spreads: [
          { id: 's1', frames: [{ ...frameV3, rotationDeg: 30 }, 'junk'] },
          'junk',
          { id: 's2' },
        ],
      })
      assert.equal(result.ok, true)
      const spreads = (result.value as { spreads: unknown[] }).spreads
      expect(spreads[0]).toMatchObject({
        frames: [{ rotationDeg: 30 }, 'junk'],
      })
      expect(spreads.slice(1)).toEqual(['junk', { id: 's2' }])
    })

    it('passes null spreads and null frames through untouched', () => {
      const result = migrateToCurrent({
        ...makeBook(),
        schemaVersion: 3,
        spreads: [null, { id: 's1', frames: [null, frameV3] }, [], 7],
      })
      assert.equal(result.ok, true)
      expect((result.value as { spreads: unknown[] }).spreads).toEqual([
        null,
        {
          id: 's1',
          frames: [null, { ...frameV3, rotationDeg: 0, kind: 'image' }],
        },
        [],
        7,
      ])
    })

    it('leaves a missing spreads field alone', () => {
      const result = migrateToCurrent({
        ...makeBook(),
        spreads: 'none',
        schemaVersion: 3,
      })
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({ schemaVersion: 8, spreads: 'none' })
    })
  })

  describe('v4 to v5', () => {
    const v4Book = (title?: unknown) => ({
      ...withoutCover(makeBook()),
      schemaVersion: 4,
      ...(title === undefined ? {} : { title }),
    })

    it('seeds cover text from the title and empty endpapers', () => {
      const result = parseBook(v4Book('Summer'))
      assert.equal(result.ok, true)
      expect(result.book.cover).toEqual({
        front: { text: 'Summer' },
        spine: { text: 'Summer' },
        back: { text: '' },
      })
      expect(result.book.endpapers).toEqual({ front: {}, back: {} })
      expect(result.book.title).toBe('Summer')
    })

    it('uses empty cover text when the title is missing', () => {
      const result = parseBook(v4Book())
      assert.equal(result.ok, true)
      expect(result.book.cover.front.text).toBe('')
    })

    it('uses empty cover text for a non-string title in the migrator', () => {
      const result = migrateToCurrent(v4Book(3))
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({ cover: defaultCover('') })
    })

    it('chains from v1', () => {
      const result = parseBook({ ...v4Book('T'), schemaVersion: 1 })
      assert.equal(result.ok, true)
      expect(result.book.cover.front.text).toBe('T')
    })
  })

  describe('v7 to v8', () => {
    const v7Book = (title?: string) => {
      const doc: Record<string, unknown> = {
        ...makeBook(title === undefined ? {} : { title }),
        schemaVersion: 7,
      }
      delete doc.frameStyles
      return doc
    }

    it('adds an empty frameStyles map and keeps the rest', () => {
      const input = v7Book('Summer')
      const result = migrateToCurrent(input)
      assert.equal(result.ok, true)
      expect(result.value).toEqual({
        ...input,
        schemaVersion: 8,
        frameStyles: {},
      })
    })

    it('yields a parseable book with unstyled frames and no background', () => {
      const result = parseBook(v7Book())
      assert.equal(result.ok, true)
      expect(result.book.frameStyles).toEqual({})
      expect(result.book.spreads[0]?.frames[0]).not.toHaveProperty(
        'frameStyleId',
      )
      expect(result.book.spreads[0]).not.toHaveProperty('backgroundColor')
    })
  })

  describe('v6 to v7', () => {
    const v6Book = (
      margins: unknown,
      spreadGrid?: unknown,
    ): Record<string, unknown> => {
      const book = makeBook({ spreads: [{ id: 's', frames: [] }] })
      return {
        ...book,
        schemaVersion: 6,
        layoutGrid: { ...book.layoutGrid, margins },
        spreads: [
          {
            id: 's',
            frames: [],
            ...(spreadGrid === undefined ? {} : { layoutGrid: spreadGrid }),
          },
        ],
      }
    }

    it('maps left / right to outside / inside in the book grid', () => {
      const result = parseBook(
        v6Book({ top: 1, right: 22, bottom: 3, left: 11 }),
      )
      assert.equal(result.ok, true)
      expect(result.book.layoutGrid.margins).toEqual({
        top: 1,
        bottom: 3,
        outside: 11,
        inside: 22,
      })
    })

    it('maps a partial spread override and keeps absent sides absent', () => {
      const result = parseBook(
        v6Book(
          { top: 1, right: 2, bottom: 3, left: 4 },
          { columns: 3, margins: { left: 9 } },
        ),
      )
      assert.equal(result.ok, true)
      expect(result.book.spreads[0]?.layoutGrid).toEqual({
        columns: 3,
        margins: { outside: 9 },
      })
    })

    it('leaves a spread without an override and odd grids alone', () => {
      const result = migrateToCurrent({
        ...v6Book({ top: 1 }),
        spreads: [null, { id: 'x', layoutGrid: 'odd' }],
        layoutGrid: { margins: 'odd' },
      })
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({
        schemaVersion: 8,
        layoutGrid: { margins: 'odd' },
        spreads: [null, { id: 'x', layoutGrid: 'odd' }],
      })
    })

    it('tolerates null margins', () => {
      const result = migrateToCurrent({
        schemaVersion: 6,
        layoutGrid: { margins: null },
        spreads: [],
      })
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({ layoutGrid: { margins: null } })
    })

    it('passes a non-object grid and missing spreads through', () => {
      const result = migrateToCurrent({
        schemaVersion: 6,
        layoutGrid: null,
        spreads: 'none',
      })
      assert.equal(result.ok, true)
      expect(result.value).toMatchObject({ layoutGrid: null, spreads: 'none' })
    })
  })

  it('a new book cover text is its title', () => {
    expect(makeBook({ title: 'Trip' }).cover.front.text).toBe('Trip')
    expect(defaultCover('Trip').spine.text).toBe('Trip')
    expect(defaultCover('Trip').back.text).toBe('')
    expect(defaultEndpapers()).toEqual({ front: {}, back: {} })
  })

  test.prop([fc.string(), fc.integer({ min: 1, max: 6 })])(
    'every older version migrates to a parseable current book',
    (title, version) => {
      const doc = withoutCover(makeBook({ title }))
      if (version >= 5) {
        Object.assign(doc, { cover: defaultCover(title) })
        Object.assign(doc, { endpapers: defaultEndpapers() })
      }
      delete doc.frameStyles
      const result = parseBook({ ...doc, schemaVersion: version })
      assert.equal(result.ok, true)
      expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.book.cover.front.text).toBe(title)
      expect(result.book.cover.spine.text).toBe(title)
    },
  )

  it('keeps the unsupported-version message for schemaVersion 0', () => {
    const result = migrateToCurrent({ schemaVersion: 0 })
    expect(result).toEqual({
      ok: false,
      code: 'invalid-shape',
      message: 'Unsupported schemaVersion 0',
    })
  })
})

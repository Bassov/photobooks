import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateToCurrent, parseBook } from './index'
import { makeBook } from './testing/fixtures'

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
      schemaVersion: 4,
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
      schemaVersion: 4,
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
      expect(result.value).toMatchObject({ schemaVersion: 4, title: '' })
    },
  )

  it('preserves string title when migrating v2 to v3', () => {
    const result = migrateToCurrent({
      ...makeBook({ title: 'Summer' }),
      schemaVersion: 2,
    })
    expect(result.ok).toBe(true)
    assert.equal(result.ok, true)
    expect(result.value).toMatchObject({ schemaVersion: 4, title: 'Summer' })
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
      expect(result.value).toMatchObject({ schemaVersion: 4, title: '' })
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
      expect(frame).toEqual({ ...frameV3, rotationDeg: 0 })
      expect(frame).not.toHaveProperty('locked')
      expect(result.value).toMatchObject({ schemaVersion: 4 })
    })

    it('migrates a v3 book into a valid current book', () => {
      const result = parseBook(v3Book([frameV3]))
      assert.equal(result.ok, true)
      expect(result.book.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.book.spreads[0]?.frames[0]?.rotationDeg).toBe(0)
    })

    it('chains v1 through v4', () => {
      const result = migrateToCurrent({
        ...v3Book([frameV3]),
        schemaVersion: 1,
      })
      expect(result).toMatchObject({
        ok: true,
        value: { schemaVersion: 4 },
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
        { id: 's1', frames: [null, { ...frameV3, rotationDeg: 0 }] },
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
      expect(result.value).toMatchObject({ schemaVersion: 4, spreads: 'none' })
    })
  })

  it('keeps the unsupported-version message for schemaVersion 0', () => {
    const result = migrateToCurrent({ schemaVersion: 0 })
    expect(result).toEqual({
      ok: false,
      code: 'invalid-shape',
      message: 'Unsupported schemaVersion 0',
    })
  })
})

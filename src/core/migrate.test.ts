import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from './index'
import { makeBook } from './testing/fixtures'

describe('migrateToCurrent', () => {
  it('accepts current schemaVersion as identity', () => {
    const input = makeBook()
    const result = migrateToCurrent(input)
    expect(result).toEqual({ ok: true, value: input })
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
    if (!result.ok && result.code === 'invalid-shape') {
      expect(result.message).toContain('schemaVersion')
    }
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
    const v1 = {
      ...makeBook(),
      schemaVersion: 1,
      assets: { a: {}, b: { stray: true } },
      gallery: ['a', 'b'],
    }
    const result = migrateToCurrent(v1)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toMatchObject({
      schemaVersion: 2,
      assets: { a: {}, b: {} },
      gallery: ['a', 'b'],
      id: v1.id,
    })
    const assets = (result.value as { assets: Record<string, unknown> }).assets
    expect(assets.a).toEqual({})
    expect(assets.b).toEqual({})
  })

  it('rejects non-finite schemaVersion', () => {
    expect(
      migrateToCurrent({ schemaVersion: Number.POSITIVE_INFINITY }),
    ).toMatchObject({
      ok: false,
      code: 'invalid-shape',
    })
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
      if (result.ok) {
        expect(
          (result.value as { assets: Record<string, unknown> }).assets,
        ).toEqual({})
        expect(result.value).toMatchObject({ schemaVersion: 2 })
      }
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

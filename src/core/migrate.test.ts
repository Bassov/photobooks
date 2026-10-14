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
})

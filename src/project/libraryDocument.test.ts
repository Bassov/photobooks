import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  LIBRARY_SCHEMA_VERSION,
  migrateLibrary,
  parseLibrary,
  serializeLibrary,
} from './libraryDocument'

const v0Fixtures: unknown[] = [
  undefined,
  null,
  [],
  'text',
  42,
  {},
  { schemaVersion: 0 },
  { schemaVersion: 'x' },
  { schemaVersion: '1' },
  { legacy: true },
]

describe('library document', () => {
  it.each(v0Fixtures)('migrates v0 fixture %j to v1', (fixture) => {
    const migrated = migrateLibrary(fixture)
    expect(migrated).toMatchObject({
      ok: true,
      value: { schemaVersion: LIBRARY_SCHEMA_VERSION },
    })
    expect(parseLibrary(fixture)).toEqual({ ok: true, meta: {} })
  })

  it('keeps a v1 document as is', () => {
    const doc = { schemaVersion: 1 }
    const migrated = migrateLibrary(doc)
    assert.equal(migrated.ok, true)
    expect(migrated.value).toBe(doc)
  })

  it('rejects a newer schemaVersion', () => {
    expect(parseLibrary({ schemaVersion: 2 })).toEqual({
      ok: false,
      code: 'newer-schema',
      schemaVersion: 2,
      supportedVersion: 1,
    })
  })

  it('serializes with the current schemaVersion', () => {
    expect(serializeLibrary({})).toEqual({ schemaVersion: 1 })
  })

  test.prop([fc.jsonValue()])(
    'parse never throws and is idempotent',
    (json) => {
      const first = migrateLibrary(json)
      if (first.ok) {
        expect(first.value.schemaVersion).toBe(LIBRARY_SCHEMA_VERSION)
        expect(migrateLibrary(first.value)).toEqual(first)
      }
      expect(parseLibrary(serializeLibrary({}))).toEqual({ ok: true, meta: {} })
    },
  )

  test.prop([fc.integer({ min: 2, max: 1_000_000 })])(
    'any newer version is rejected',
    (schemaVersion) => {
      expect(parseLibrary({ schemaVersion })).toMatchObject({
        ok: false,
        code: 'newer-schema',
        schemaVersion,
      })
    },
  )
})

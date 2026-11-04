import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  LIBRARY_SCHEMA_VERSION,
  migrateLibrary,
  parseLibrary,
  serializeLibrary,
} from './libraryDocument'
import type { BookPublishEntry } from './types'

const PBT_RUNS = { numRuns: 1000 }

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

const bookEntries = fc.dictionary(
  // Zod drops a `__proto__` record key on parse; book ids are generated.
  fc.string({ minLength: 1 }).filter((id) => id !== '__proto__'),
  fc.record({
    status: fc.constantFrom<BookPublishEntry['status']>('draft', 'published'),
  }),
)

describe('library document', () => {
  it.each(v0Fixtures)('upgrades v0 fixture %j to v2', (fixture) => {
    const migrated = migrateLibrary(fixture)
    expect(migrated).toMatchObject({
      ok: true,
      value: { schemaVersion: LIBRARY_SCHEMA_VERSION, books: {} },
    })
    expect(parseLibrary(fixture)).toEqual({ ok: true, meta: { books: {} } })
  })

  it('upgrades a v1 document to an empty status map', () => {
    expect(migrateLibrary({ schemaVersion: 1 })).toEqual({
      ok: true,
      value: { schemaVersion: 2, books: {} },
    })
  })

  it('keeps a v2 document as is', () => {
    const doc = { schemaVersion: 2, books: { a: { status: 'published' } } }
    const migrated = migrateLibrary(doc)
    assert.equal(migrated.ok, true)
    expect(migrated.value).toBe(doc)
    expect(parseLibrary(doc)).toEqual({
      ok: true,
      meta: { books: { a: { status: 'published' } } },
    })
  })

  it.each([
    { schemaVersion: 2 },
    { schemaVersion: 2, books: [] },
    { schemaVersion: 2, books: { a: { status: 'live' } } },
    { schemaVersion: 2, books: { a: {} } },
    { schemaVersion: 2, books: { '': { status: 'draft' } } },
  ])('fails an invalid v2 document %j as corrupted', (doc) => {
    expect(parseLibrary(doc)).toEqual({ ok: false, code: 'corrupted' })
  })

  it('rejects a newer schemaVersion', () => {
    expect(parseLibrary({ schemaVersion: 3 })).toEqual({
      ok: false,
      code: 'newer-schema',
      schemaVersion: 3,
      supportedVersion: 2,
    })
  })

  it('serializes with the current schemaVersion and an empty map', () => {
    expect(serializeLibrary({})).toEqual({ schemaVersion: 2, books: {} })
  })

  test.prop([fc.jsonValue()], PBT_RUNS)(
    'migrate never throws and is idempotent',
    (json) => {
      const first = migrateLibrary(json)
      if (first.ok) {
        expect(first.value.schemaVersion).toBe(LIBRARY_SCHEMA_VERSION)
        expect(migrateLibrary(first.value)).toEqual(first)
      }
    },
  )

  test.prop(
    [
      fc.oneof(
        fc.constant<number | undefined>(undefined),
        fc.constant(0),
        fc.constant(1),
      ),
      fc.dictionary(fc.string(), fc.jsonValue()),
    ],
    PBT_RUNS,
  )('any v0 / v1 document upgrades to an empty v2 map', (version, extra) => {
    const doc = { ...extra, schemaVersion: version }
    expect(parseLibrary(doc)).toEqual({ ok: true, meta: { books: {} } })
  })

  test.prop([bookEntries], PBT_RUNS)(
    'serialize then parse round-trips the status map',
    (books) => {
      const text = JSON.stringify(serializeLibrary({ books }))
      expect(parseLibrary(JSON.parse(text))).toEqual({
        ok: true,
        meta: { books },
      })
    },
  )

  test.prop([fc.integer({ min: 3, max: 1_000_000 })])(
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

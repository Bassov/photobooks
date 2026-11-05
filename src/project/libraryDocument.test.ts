import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { genericPrintProfile, type SavedTemplate } from '../core'
import { makeCustomPrintProfile } from '../core/testing/fixtures'
import {
  LIBRARY_SCHEMA_VERSION,
  migrateLibrary,
  parseDefaultPrintProfileId,
  parseLegacySavedTemplates,
  parseLibrary,
  parsePrintProfiles,
  parseSavedTemplates,
  serializeLibrary,
} from './libraryDocument'
import type { BookPublishEntry } from './types'

const PBT_RUNS = { numRuns: 1000 }

/** v4 fields of a library without custom printer profiles. */
const NO_CUSTOM_PROFILES = {
  printProfiles: [],
  defaultPrintProfileId: 'generic',
}
const EMPTY = { books: {}, templates: [], ...NO_CUSTOM_PROFILES }
const CUSTOM = makeCustomPrintProfile()

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

// JSON has no -0: `+ 0` folds it into 0.
const pct = fc.double({ min: -50, max: 150, noNaN: true }).map((v) => v + 0)
const size = fc.double({ min: 0.01, max: 150, noNaN: true })

const savedTemplate: fc.Arbitrary<SavedTemplate> = fc.record({
  id: fc.stringMatching(/^user-[\w-]{1,12}$/),
  // Names are stored trimmed (the parse trims them).
  name: fc
    .string({ minLength: 1 })
    .map((name) => name.trim())
    .filter((name) => name !== ''),
  pages: fc.constantFrom<1 | 2>(1, 2),
  slots: fc.array(fc.record({ x: pct, y: pct, w: size, h: size }), {
    minLength: 1,
    maxLength: 4,
  }),
})

const OPENER: SavedTemplate = {
  id: 'user-opener',
  name: 'Travel opener',
  pages: 2,
  slots: [{ x: 0, y: 0, w: 62, h: 100 }],
}

describe('library document', () => {
  it.each(v0Fixtures)('upgrades v0 fixture %j to v4', (fixture) => {
    const migrated = migrateLibrary(fixture)
    expect(migrated).toMatchObject({
      ok: true,
      value: {
        schemaVersion: LIBRARY_SCHEMA_VERSION,
        books: {},
        templates: [],
        ...NO_CUSTOM_PROFILES,
      },
    })
    expect(parseLibrary(fixture)).toEqual({ ok: true, meta: EMPTY })
  })

  it('upgrades a v1 document to an empty status map and no templates', () => {
    expect(migrateLibrary({ schemaVersion: 1 })).toEqual({
      ok: true,
      value: {
        schemaVersion: 4,
        books: {},
        templates: [],
        ...NO_CUSTOM_PROFILES,
      },
    })
  })

  it('upgrades a v2 document to v4 keeping its status map', () => {
    const doc = { schemaVersion: 2, books: { a: { status: 'published' } } }
    expect(migrateLibrary(doc)).toEqual({
      ok: true,
      value: { ...doc, schemaVersion: 4, templates: [], ...NO_CUSTOM_PROFILES },
    })
    expect(parseLibrary(doc)).toEqual({
      ok: true,
      meta: { ...EMPTY, books: { a: { status: 'published' } } },
    })
  })

  it('upgrades a v3 document to no custom profiles and the Generic default, keeping its templates', () => {
    const doc = { schemaVersion: 3, books: {}, templates: [OPENER] }
    expect(migrateLibrary(doc)).toEqual({
      ok: true,
      value: { ...doc, schemaVersion: 4, ...NO_CUSTOM_PROFILES },
    })
    expect(parseLibrary(doc)).toEqual({
      ok: true,
      meta: { ...EMPTY, templates: [OPENER] },
    })
  })

  it('keeps a v4 document as is', () => {
    const doc = {
      schemaVersion: 4,
      books: {},
      templates: [OPENER],
      printProfiles: [CUSTOM],
      defaultPrintProfileId: CUSTOM.id,
    }
    const migrated = migrateLibrary(doc)
    assert.equal(migrated.ok, true)
    expect(migrated.value).toBe(doc)
    expect(parseLibrary(doc)).toEqual({
      ok: true,
      meta: {
        books: {},
        templates: [OPENER],
        printProfiles: [CUSTOM],
        defaultPrintProfileId: CUSTOM.id,
      },
    })
  })

  it('drops an invalid custom profile or one with a built-in id, one at a time', () => {
    const second = { ...CUSTOM, id: 'custom-two', name: 'Two' }
    expect(
      parsePrintProfiles([
        CUSTOM,
        { ...CUSTOM, id: 'custom-bad', trimMinMm: 0 },
        { ...CUSTOM, pageCount: { min: 24, step: 4, max: 81 } },
        { ...genericPrintProfile(), name: 'Generic copy' },
        'text',
        null,
        second,
      ]),
    ).toEqual([CUSTOM, second])
  })

  it.each([undefined, null, 'x', {}, 42])(
    'reads custom profiles %j that are not a list as none',
    (printProfiles) => {
      expect(parsePrintProfiles(printProfiles)).toEqual([])
    },
  )

  it.each([
    [undefined, 'generic'],
    ['', 'generic'],
    [42, 'generic'],
    ['custom-lab', 'custom-lab'],
  ])('reads the default profile id %j as %j', (input, id) => {
    expect(parseDefaultPrintProfileId(input)).toBe(id)
  })

  it.each([
    { schemaVersion: 3 },
    { schemaVersion: 3, books: [] },
    { schemaVersion: 3, books: { a: { status: 'live' } } },
    { schemaVersion: 3, books: { a: {} } },
    { schemaVersion: 3, books: { '': { status: 'draft' } } },
  ])('fails an invalid status map %j as corrupted', (doc) => {
    expect(parseLibrary(doc)).toEqual({ ok: false, code: 'corrupted' })
  })

  it('drops invalid templates one by one and keeps the rest in order', () => {
    const second = { ...OPENER, id: 'user-two', pages: 1 }
    const doc = {
      schemaVersion: 3,
      books: {},
      templates: [
        OPENER,
        { ...OPENER, id: 'user-bad', pages: 3 },
        { ...OPENER, id: 'full-bleed' },
        { ...OPENER, id: 'xuser-a' },
        { ...OPENER, id: 'user-a!' },
        { ...OPENER, name: '  ' },
        { ...OPENER, slots: [] },
        { ...OPENER, slots: [{ x: 0, y: 0, w: 0, h: 5 }] },
        { id: 'user-legacy', name: 'No pages', slots: OPENER.slots },
        'text',
        null,
        second,
      ],
    }
    expect(parseLibrary(doc)).toEqual({
      ok: true,
      meta: { ...EMPTY, templates: [OPENER, second] },
    })
  })

  it('bounds slot values and counts so a crafted file cannot overflow the frame math', () => {
    const slot = { x: 0, y: 0, w: 50, h: 100 }
    const withSlots = (id: string, slots: unknown[]) => ({
      ...OPENER,
      id: `user-${id}`,
      slots,
    })
    const kept = [
      withSlots('edge', [{ x: -1000, y: 1000, w: 1000, h: 1000 }]),
      withSlots(
        'many',
        Array.from({ length: 500 }, () => slot),
      ),
    ]
    const dropped = [
      withSlots('x-low', [{ ...slot, x: -1001 }]),
      withSlots('y-high', [{ ...slot, y: 1001 }]),
      withSlots('w-high', [{ ...slot, w: 1001 }]),
      withSlots('h-huge', [{ ...slot, h: 1e306 }]),
      withSlots(
        'too-many',
        Array.from({ length: 501 }, () => slot),
      ),
    ]
    expect(parseSavedTemplates([...kept, ...dropped])).toEqual(kept)
  })

  it.each([undefined, null, 'x', {}, 42])(
    'reads templates %j that are not a list as none',
    (templates) => {
      expect(parseLibrary({ schemaVersion: 3, books: {}, templates })).toEqual({
        ok: true,
        meta: EMPTY,
      })
      expect(parseSavedTemplates(templates)).toEqual([])
    },
  )

  it('reads the legacy localStorage list as two-page layouts, one entry at a time', () => {
    const legacy = { id: OPENER.id, name: OPENER.name, slots: OPENER.slots }
    expect(
      parseLegacySavedTemplates([
        legacy,
        { ...legacy, id: 'full-bleed' },
        { ...legacy, id: 'user-page', pages: 1 },
      ]),
    ).toEqual([OPENER, { ...OPENER, id: 'user-page', pages: 2 }])
    expect(parseLegacySavedTemplates(null)).toEqual([])
    expect(parseLegacySavedTemplates({ ...legacy })).toEqual([])
  })

  it('rejects a newer schemaVersion', () => {
    expect(parseLibrary({ schemaVersion: 5 })).toEqual({
      ok: false,
      code: 'newer-schema',
      schemaVersion: 5,
      supportedVersion: 4,
    })
  })

  it('serializes with the current schemaVersion, an empty map, no templates and no custom profiles', () => {
    expect(serializeLibrary({})).toEqual({
      schemaVersion: 4,
      books: {},
      templates: [],
      ...NO_CUSTOM_PROFILES,
    })
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
  )(
    'any v0 / v1 document upgrades to an empty v4 library',
    (version, extra) => {
      const doc = { ...extra, schemaVersion: version }
      expect(parseLibrary(doc)).toEqual({ ok: true, meta: EMPTY })
    },
  )

  test.prop(
    [
      bookEntries,
      fc.array(savedTemplate, { maxLength: 5 }),
      fc.uniqueArray(fc.stringMatching(/^custom-[a-z]{1,8}$/), {
        maxLength: 3,
      }),
    ],
    PBT_RUNS,
  )(
    'serialize then parse round-trips the status map, the templates and the custom profiles',
    (books, templates, ids) => {
      const printProfiles = ids.map((id) => makeCustomPrintProfile({ id }))
      const defaultPrintProfileId = ids.at(-1) ?? 'generic'
      const text = JSON.stringify(
        serializeLibrary({
          books,
          templates,
          printProfiles,
          defaultPrintProfileId,
        }),
      )
      expect(parseLibrary(JSON.parse(text))).toEqual({
        ok: true,
        meta: { books, templates, printProfiles, defaultPrintProfileId },
      })
    },
    // ~0.4 s alone; headroom for a loaded CI runner.
    20_000,
  )

  test.prop([fc.integer({ min: 5, max: 1_000_000 })])(
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

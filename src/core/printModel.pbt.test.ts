import assert from 'node:assert/strict'
import { fc, test } from '@fast-check/vitest'
import { expect } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  SPINE_WIDTH_SOURCES,
  defaultCover,
  defaultCoverPrint,
  defaultPrintProfileRef,
  migrateToCurrent,
  parseBook,
  serializeBook,
  type Book,
} from './index'
import { makeBook, makeSpread } from './testing/fixtures'

/** Done-when floor for this item: at least 1000 runs per property. */
const NUM_RUNS = Math.max(1000, Number(process.env.FC_NUM_RUNS ?? 0))

const mmArb = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true })

const overridesArb = fc.record(
  {
    trimMinMm: mmArb(1, 600),
    trimMaxMm: mmArb(1, 600),
    bleedMinMm: mmArb(0, 20),
    bleedMaxMm: mmArb(0, 20),
  },
  { requiredKeys: [] },
)

const printProfileArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  overrides: overridesArb,
})

/** Valid current books with and without the v11 print fields. */
const bookArb: fc.Arbitrary<Book> = fc
  .record({
    title: fc.string({ maxLength: 16 }),
    widthMm: mmArb(1, 600),
    heightMm: mmArb(1, 600),
    bleedMm: mmArb(0, 20),
    spreadCount: fc.integer({ min: 1, max: 4 }),
    printProfile: fc.option(printProfileArb, { nil: undefined }),
    spineWidthSource: fc.option(fc.constantFrom(...SPINE_WIDTH_SOURCES), {
      nil: undefined,
    }),
  })
  .map((g) => {
    const cover = defaultCover(g.title)
    delete cover.print
    return makeBook({
      title: g.title,
      settings: {
        trim: { widthMm: g.widthMm, heightMm: g.heightMm },
        bleedMm: g.bleedMm,
      },
      spreads: Array.from({ length: g.spreadCount }, (_, i) =>
        makeSpread({ id: `s${String(i)}`, frames: [] }),
      ),
      cover:
        g.spineWidthSource === undefined
          ? cover
          : { ...cover, print: { spineWidthSource: g.spineWidthSource } },
      ...(g.printProfile === undefined ? {} : { printProfile: g.printProfile }),
    })
  })

/** The same book as a v10 document (no print fields existed yet). */
function asV10(book: Book): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...book, schemaVersion: 10 }
  delete doc.printProfile
  const cover: Record<string, unknown> = { ...book.cover }
  delete cover.print
  return { ...doc, cover }
}

function migrated(input: unknown): unknown {
  const result = migrateToCurrent(input)
  assert.equal(result.ok, true)
  return result.value
}

test.prop([bookArb], { numRuns: NUM_RUNS })(
  'parse(serialize(book)) round-trips the print fields',
  (book) => {
    const result = parseBook(serializeBook(book))
    assert.equal(result.ok, true)
    expect(result.book).toEqual(book)
  },
)

test.prop([bookArb.map(asV10)], { numRuns: NUM_RUNS })(
  'v10 → v11 adds only the default print fields',
  (doc) => {
    expect(migrated(doc)).toEqual({
      ...doc,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      printProfile: defaultPrintProfileRef(),
      cover: { ...(doc.cover as object), print: defaultCoverPrint() },
    })
  },
)

test.prop([fc.oneof(bookArb, bookArb.map(asV10))], { numRuns: NUM_RUNS })(
  'migrate is idempotent and parses as the current shape',
  (doc) => {
    const once = migrated(structuredClone(doc))
    expect(migrated(structuredClone(once))).toEqual(once)
    const parsed = parseBook(once)
    assert.equal(parsed.ok, true)
    expect(parsed.book).toEqual(once)
  },
)

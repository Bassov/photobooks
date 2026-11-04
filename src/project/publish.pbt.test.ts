import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { serializeBook, type Book } from '../core'
import { setCoverPhoto } from '../core/cover'
import { placeAsset } from '../core/ops/place'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { parseLibrary, serializeLibrary } from './libraryDocument'
import {
  bookPublishStatus,
  parsePublished,
  publishBook,
  serializePublished,
  unpublishBook,
  type PublishedRevision,
} from './publish'
import type { LibraryMeta, PublishStatus } from './types'

const PBT_RUNS = { numRuns: 1000 }
const BOOK_IDS = ['b1', 'b2'] as const
const ASSET_IDS = ['a1', 'a2', 'a3', 'a4'] as const

type Step =
  | { type: 'publish'; book: number; atMs: number }
  | { type: 'unpublish'; book: number }
  | { type: 'place'; book: number; frameId: string; assetId: string }
  | { type: 'cover'; book: number; assetId: string }
  /** In-place mutation of the draft: the revision must not share it. */
  | { type: 'mutate'; book: number; title: string; assetId: string }

const bookIndex = fc.integer({ min: 0, max: BOOK_IDS.length - 1 })
const assetId = fc.constantFrom(...ASSET_IDS)

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    type: fc.constant('publish' as const),
    book: bookIndex,
    atMs: fc.nat(),
  }),
  fc.record({ type: fc.constant('unpublish' as const), book: bookIndex }),
  fc.record({
    type: fc.constant('place' as const),
    book: bookIndex,
    frameId: fc.constantFrom('f1', 'f2'),
    assetId,
  }),
  fc.record({ type: fc.constant('cover' as const), book: bookIndex, assetId }),
  fc.record({
    type: fc.constant('mutate' as const),
    book: bookIndex,
    title: fc.string(),
    assetId,
  }),
)

function initialBook(id: string): Book {
  return makeBook({
    id,
    assets: Object.fromEntries(ASSET_IDS.map((asset) => [asset, {}])),
    gallery: [...ASSET_IDS],
    spreads: [
      makeSpread({
        id: 's1',
        frames: [makeFrame({ id: 'f1' }), makeFrame({ id: 'f2' })],
      }),
    ],
  })
}

const bookJson = (book: Book) => JSON.stringify(serializeBook(book))

function edit(book: Book, current: Step): Book {
  switch (current.type) {
    case 'place':
      return placeAsset(book, 's1', current.frameId, current.assetId)
    case 'cover':
      return setCoverPhoto(book, current.assetId)
    case 'mutate': {
      book.title = current.title
      const frame = book.spreads[0]?.frames[0]
      if (frame !== undefined) {
        frame.assetId = current.assetId
      }
      return book
    }
    default:
      return book
  }
}

describe('draft / published transitions', () => {
  test.prop([fc.array(step, { maxLength: 24 })], PBT_RUNS)(
    'publish freezes a revision; later edits leave it unchanged',
    (steps) => {
      let meta: LibraryMeta = {}
      const drafts: Book[] = BOOK_IDS.map(initialBook)
      const status: PublishStatus[] = BOOK_IDS.map(() => 'draft')
      const revisions = new Map<string, PublishedRevision>()
      const frozen = new Map<string, { json: string; atMs: number }>()

      for (const current of steps) {
        const draft = drafts[current.book]
        if (draft === undefined) {
          throw new Error('book index out of range')
        }
        if (current.type === 'publish') {
          const published = publishBook(meta, draft, current.atMs)
          meta = published.meta
          revisions.set(draft.id, published.revision)
          frozen.set(draft.id, { json: bookJson(draft), atMs: current.atMs })
          status[current.book] = 'published'
        } else if (current.type === 'unpublish') {
          meta = unpublishBook(meta, draft.id)
          status[current.book] = 'draft'
        } else {
          drafts[current.book] = edit(draft, current)
        }

        BOOK_IDS.forEach((id, index) => {
          expect(bookPublishStatus(meta, id)).toBe(status[index])
        })
        for (const [id, revision] of revisions) {
          const expected = frozen.get(id)
          expect(revision.bookId).toBe(id)
          expect(revision.publishedAtMs).toBe(expected?.atMs)
          expect(bookJson(revision.book)).toBe(expected?.json)
        }
      }

      const stored = JSON.parse(JSON.stringify(serializeLibrary(meta)))
      expect(parseLibrary(stored)).toEqual({
        ok: true,
        meta: { books: meta.books ?? {} },
      })
      for (const revision of revisions.values()) {
        const text = JSON.stringify(serializePublished(revision))
        expect(parsePublished(JSON.parse(text))).toEqual({
          ok: true,
          revision,
        })
      }
    },
    30_000,
  )
})

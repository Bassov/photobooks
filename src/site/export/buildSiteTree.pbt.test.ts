import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { DERIVATIVE_PRESETS } from '../../derivatives/plan'
import { unpublishBook, type LibraryMeta } from '../../project'
import { buildSiteTree, type SiteExportInput } from '.'
import {
  allText,
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
  referencedPaths,
  sha256Hex,
} from './siteExport.test-helpers'

const PBT_RUNS = { numRuns: 1000 }
/** 1000 async runs with Web Crypto hashing; parallel `check:fast` load needs headroom. */
const PBT_TIMEOUT_MS = 60_000
const PHOTOS = [1, 2, 3, 4, 5, 6].map(photoHash)
/** Only ever added to a draft after publishing. */
const DRAFT_PHOTO = photoHash(0x99)

type Status = 'published' | 'unpublished' | 'none'

interface BookCase {
  status: Status
  spreads: string[][]
  editDraft: boolean
}

const bookCase: fc.Arbitrary<BookCase> = fc.record({
  status: fc.constantFrom<Status>('published', 'unpublished', 'none'),
  spreads: fc.array(fc.array(fc.constantFrom(...PHOTOS), { maxLength: 3 }), {
    minLength: 1,
    maxLength: 3,
  }),
  editDraft: fc.boolean(),
})

const ALL_DERIVATIVES = [...PHOTOS, DRAFT_PHOTO].flatMap((hash) =>
  derivativesFor(hash),
)

const scenario = fc.record({
  books: fc.array(bookCase, { maxLength: 4 }),
  derivatives: fc.subarray(ALL_DERIVATIVES),
})

const titleOf = (index: number) => `«bk-${String(index)}»`

/** Publishes every case, then unpublishes / forgets / edits the draft per case. */
function libraryOf({
  books,
  derivatives,
}: {
  books: BookCase[]
  derivatives: SiteExportInput['derivatives']
}): SiteExportInput {
  const drafts = books.map((book, index) =>
    makePhotoBook(`bk-${String(index)}`, titleOf(index), book.spreads),
  )
  const published = publishAll(drafts)
  let meta: LibraryMeta = published.meta
  books.forEach((book, index) => {
    const id = `bk-${String(index)}`
    if (book.status === 'unpublished') {
      meta = unpublishBook(meta, id)
    }
    if (book.status === 'none') {
      meta = {
        books: Object.fromEntries(
          Object.entries(meta.books ?? {}).filter(([key]) => key !== id),
        ),
      }
    }
    const draft = drafts[index]
    if (book.editDraft && draft !== undefined) {
      draft.title = `«draft-${String(index)}»`
      draft.assets['asset-draft'] = { contentHash: DRAFT_PHOTO }
      draft.spreads[0]?.frames.push({
        id: 'frame-draft',
        rect: { x: 0, y: 0, width: 10, height: 10 },
        z: 9,
        assetId: 'asset-draft',
      })
    }
  })
  return { meta, revisions: published.revisions, derivatives }
}

const publishedCases = (books: BookCase[]) =>
  books.filter((book) => book.status === 'published')

describe('buildSiteTree (PBT)', () => {
  test.prop([scenario, fc.gen()], PBT_RUNS)(
    'output is independent of the input order of books and photos',
    async (generated, g) => {
      const input = libraryOf(generated)
      const shuffled: SiteExportInput = {
        ...input,
        revisions: g(fc.shuffledSubarray, [...input.revisions], {
          minLength: input.revisions.length,
        }),
        derivatives: g(fc.shuffledSubarray, [...input.derivatives], {
          minLength: input.derivatives.length,
        }),
      }

      const tree = await buildSiteTree(input)
      const again = await buildSiteTree(shuffled)

      expect(again).toStrictEqual(tree)
    },
    PBT_TIMEOUT_MS,
  )

  test.prop([scenario], PBT_RUNS)(
    'only published revisions appear; unpublished books and draft edits never do',
    async (generated) => {
      const input = libraryOf(generated)
      const wanted = new Set(
        publishedCases(generated.books).flatMap((book) => book.spreads.flat()),
      )
      const expectedAssets = await Promise.all(
        input.derivatives
          .filter((derivative) => wanted.has(derivative.assetHash))
          .map(async (derivative) => sha256Hex(derivative.bytes)),
      )

      const tree = await buildSiteTree(input)

      const text = allText(tree)
      const shownTitles = generated.books
        .map((_, index) => titleOf(index))
        .filter((title) => text.includes(title))
      expect(shownTitles).toStrictEqual(
        generated.books
          .map((book, index) => ({ book, title: titleOf(index) }))
          .filter(({ book }) => book.status === 'published')
          .map(({ title }) => title),
      )
      expect(text).not.toMatch(/«draft-/)
      expect(text).not.toContain(DRAFT_PHOTO)
      expect(
        tree.files.filter((file) => file.path.startsWith('books/')),
      ).toHaveLength(publishedCases(generated.books).length)
      expect(
        new Set(
          tree.files
            .filter((file) => file.path.startsWith('assets/'))
            .map((file) => file.path.slice('assets/'.length).split('.')[0]),
        ),
      ).toStrictEqual(new Set(expectedAssets))
    },
    PBT_TIMEOUT_MS,
  )

  test.prop([scenario], PBT_RUNS)(
    'every referenced file exists; wanted derivatives absent from the input are missing',
    async (generated) => {
      const input = libraryOf(generated)
      const given = new Set(
        input.derivatives.map((d) => `${d.assetHash}/${d.presetId}`),
      )
      const wanted = [
        ...new Set(
          publishedCases(generated.books).flatMap((book) =>
            book.spreads.flat(),
          ),
        ),
      ]
      const expectedMissing = wanted
        .sort()
        .flatMap((assetHash) =>
          DERIVATIVE_PRESETS.map((preset) => ({
            assetHash,
            presetId: preset.id,
          })),
        )
        .filter(
          ({ assetHash, presetId }) => !given.has(`${assetHash}/${presetId}`),
        )

      const tree = await buildSiteTree(input)

      const paths = new Set(tree.files.map((file) => file.path))
      expect(
        referencedPaths(tree).filter((path) => !paths.has(path)),
      ).toStrictEqual([])
      expect(tree.missing).toStrictEqual(expectedMissing)
    },
    PBT_TIMEOUT_MS,
  )
})

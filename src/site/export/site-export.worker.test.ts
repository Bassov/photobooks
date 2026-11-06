import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  runSiteExport,
  SITE_EXPORT_PROGRESS_MS,
  type SiteExportMessage,
  type SiteExportRequest,
} from './site-export.worker'
import { createMemorySiteDirectory } from './memorySiteDirectory.test-helpers'
import {
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
} from './siteExport.test-helpers'

const PHOTOS = [1, 2, 3, 4, 5, 6].map(photoHash)

/** Two published books and one revision of an unpublished one, cloned as `postMessage` would carry them. */
function exportInput(): SiteExportRequest['input'] {
  const { meta, revisions } = publishAll([
    makePhotoBook('book-a', 'A', [PHOTOS.slice(0, 3)]),
    makePhotoBook('book-b', 'B', [PHOTOS.slice(3)]),
  ])
  const unpublished = {
    bookId: 'book-c',
    publishedAtMs: 1,
    book: makePhotoBook('book-c', 'C', [PHOTOS]),
  }
  return structuredClone({
    meta,
    revisions: [...revisions, unpublished],
    derivatives: PHOTOS.flatMap((hash) => derivativesFor(hash)),
  })
}

interface Totals {
  books: number
  files: number
  bytes: number
}

function totalsOf(message: SiteExportMessage | undefined): Totals | undefined {
  return message !== undefined && !('phase' in message) && 'done' in message
    ? message.done
    : undefined
}

/** Runs one export with a clock that moves `stepMs` per read; posts carry their time. */
async function run(
  folder: ReturnType<typeof createMemorySiteDirectory>,
  stepMs = 50,
): Promise<{ at: number; message: SiteExportMessage }[]> {
  let clock = 0
  const posts: { at: number; message: SiteExportMessage }[] = []
  await runSiteExport(
    { folder: folder.root, input: exportInput() },
    (message) => posts.push({ at: clock, message }),
    () => (clock += stepMs),
  )
  return posts
}

describe('runSiteExport', () => {
  it('throttles progress to one post per 250 ms, then posts the totals', async () => {
    const folder = createMemorySiteDirectory()

    const posts = await run(folder)

    const progress = posts.filter(({ message }) => 'phase' in message)
    const final = posts.at(-1)?.message
    expect(final).toEqual({
      done: { books: 2, files: expect.any(Number), bytes: expect.any(Number) },
    })
    expect(progress[0]?.message).toEqual({ phase: 'render', done: 0, total: 1 })
    expect(progress.length).toBeGreaterThan(2)
    expect(progress.length).toBeLessThan(Number(totalsOf(final)?.files))
    const times = progress.map(({ at }) => at)
    const gaps = times.slice(1).map((at, i) => at - Number(times[i]))
    expect(gaps.every((gap) => gap === SITE_EXPORT_PROGRESS_MS)).toBe(true)
    expect(posts.length).toBe(progress.length + 1)
  })

  it('reports write progress against the tree file count', async () => {
    const posts = await run(createMemorySiteDirectory(), 1_000)

    const writes = posts.flatMap(({ message }) =>
      'phase' in message && message.phase === 'write' ? [message] : [],
    )
    const total = totalsOf(posts.at(-1)?.message)
    expect(writes.at(-1)).toEqual({
      phase: 'write',
      done: total?.files,
      total: total?.files,
    })
    expect(total?.bytes).toBeGreaterThan(0)
  })

  it('writes the viewer bundle a request carries under dist/viewer/', async () => {
    const folder = createMemorySiteDirectory()
    const viewer = {
      entry: 'assets/site.js',
      css: ['assets/site.css'],
      files: [
        { path: 'assets/site.css', bytes: new TextEncoder().encode('a{}') },
        { path: 'assets/site.js', bytes: new TextEncoder().encode('x()') },
      ],
    }
    const posts: SiteExportMessage[] = []

    await runSiteExport(
      { folder: folder.root, input: { ...exportInput(), viewer } },
      (message) => posts.push(message),
      () => 0,
    )

    expect(posts.at(-1)).toMatchObject({ done: { books: 2 } })
    expect(folder.ops).toEqual(
      expect.arrayContaining([
        'write dist/viewer/assets/site.css',
        'write dist/viewer/assets/site.js',
      ]),
    )
  })

  it('replaces its own earlier export', async () => {
    const folder = createMemorySiteDirectory()
    await run(folder)

    const posts = await run(folder)

    expect(posts.at(-1)?.message).toMatchObject({ done: { books: 2 } })
  })

  it('fails with not-our-export on a foreign dist', async () => {
    const posts = await run(
      createMemorySiteDirectory({ 'dist/readme.txt': 'mine' }),
    )

    expect(posts.at(-1)?.message).toEqual({
      failed: { code: 'not-our-export' },
    })
  })

  it.each([
    ['QuotaExceededError', 'quota'],
    ['NotAllowedError', 'permission'],
    ['NotReadableError', 'unknown'],
  ])('maps a thrown %s to %s', async (name, code) => {
    const folder = createMemorySiteDirectory()
    folder.failNextWrite(new DOMException('x', name))

    const posts = await run(folder)

    expect(posts.at(-1)?.message).toEqual({ failed: { code } })
  })
})

describe('site-export.worker shell', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'postMessage')
    vi.restoreAllMocks()
  })

  it('runs a posted request on the performance clock', async () => {
    // A stopped clock: only the first progress post gets through.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage
    const request: SiteExportRequest = {
      folder: createMemorySiteDirectory().root,
      input: exportInput(),
    }

    handler?.({ data: request } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenLastCalledWith({
        done: expect.objectContaining({ books: 2 }),
      })
    })
    expect(postMessage).toHaveBeenNthCalledWith(1, {
      phase: 'render',
      done: 0,
      total: 1,
    })
    expect(postMessage).toHaveBeenCalledTimes(2)
  })
})

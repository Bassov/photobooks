import { IDBFactory } from 'fake-indexeddb'
import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
} from '../site/export/siteExport.test-helpers'
import { createCredentialStore, type R2Credentials } from './credentials'
import {
  CREDENTIALS,
  createFakeR2,
  createFakeSleep,
  s3Error,
} from './fakeR2.test-helpers'
import {
  PUBLISH_PROGRESS_MS,
  runPublish,
  type PublishMessage,
  type PublishRequest,
} from './publish.worker'
import { PUBLISH_MANIFEST_KEY } from './publishSite'

const PHOTOS = [1, 2, 3, 4].map(photoHash)
const NOW = new Date('2026-11-13T10:00:00Z')

/** Two published books, cloned as `postMessage` would carry them. */
function request(bookId?: string): PublishRequest {
  const { meta, revisions } = publishAll([
    makePhotoBook('book-a', 'A', [PHOTOS.slice(0, 2)]),
    makePhotoBook('book-b', 'B', [PHOTOS.slice(2)]),
  ])
  return structuredClone({
    input: {
      meta,
      revisions,
      derivatives: PHOTOS.flatMap((hash) => derivativesFor(hash)),
    },
    ...(bookId === undefined ? {} : { bookId }),
  })
}

async function connected(
  credentials: R2Credentials = CREDENTIALS,
): Promise<IDBFactory> {
  const factory = new IDBFactory()
  await createCredentialStore(factory).save(credentials)
  return factory
}

/** Runs one publish with a clock that moves 50 ms per read; posts carry their time. */
async function run(
  publishRequest: PublishRequest,
  indexedDB: IDBFactory,
  r2 = createFakeR2(),
): Promise<{ at: number; message: PublishMessage }[]> {
  let clock = 0
  const posts: { at: number; message: PublishMessage }[] = []
  await runPublish(
    publishRequest,
    (message) => posts.push({ at: clock, message }),
    {
      clock: () => (clock += 50),
      indexedDB,
      publish: {
        fetch: r2.fetch,
        now: () => NOW,
        sleep: createFakeSleep().sleep,
        isOnline: () => true,
      },
    },
  )
  return posts
}

describe('runPublish', () => {
  it('builds, uploads and links the book; posts throttled phases and one result', async () => {
    const factory = await connected()
    const r2 = createFakeR2()

    const posts = await run(request('book-a'), factory, r2)

    const final = posts.at(-1)?.message
    expect(final).toEqual({
      done: {
        uploaded: expect.any(Number),
        bytes: expect.any(Number),
        removed: 0,
        unchanged: 0,
        bookUrl: expect.stringMatching(
          /^https:\/\/books\.example\.com\/books\/[0-9a-f]{16}\/$/,
        ),
      },
    })
    const bookUrl =
      final !== undefined && 'done' in final && typeof final.done === 'object'
        ? final.done.bookUrl
        : ''
    const bookKey = `${new URL(bookUrl).pathname.slice(1)}index.html`
    expect(r2.objects.has(bookKey)).toBe(true)
    expect(r2.objects.has(PUBLISH_MANIFEST_KEY)).toBe(true)

    const progress = posts.slice(0, -1)
    expect(progress[0]?.message).toEqual({ phase: 'render', done: 0, total: 1 })
    for (const { message } of progress) {
      expect(Object.keys(message).sort()).toEqual(['done', 'phase', 'total'])
    }
    const phases = new Set(
      progress.map(({ message }) => ('phase' in message ? message.phase : '')),
    )
    expect(
      [...phases].every((p) => ['render', 'upload', 'finish'].includes(p)),
    ).toBe(true)
    expect(phases.has('upload')).toBe(true)
    const times = progress.map(({ at }) => at)
    const gaps = times.slice(1).map((at, i) => at - Number(times[i]))
    expect(gaps.every((gap) => gap >= PUBLISH_PROGRESS_MS)).toBe(true)
    expect(await createCredentialStore(factory).loadStatus()).toEqual({
      checkedAtMs: NOW.getTime(),
      ok: true,
    })
  })

  it('links the site home without a book id or for an unpublished one', async () => {
    const factory = await connected()

    for (const bookId of [undefined, 'book-x']) {
      const posts = await run(request(bookId), factory)

      expect(posts.at(-1)?.message).toMatchObject({
        done: { bookUrl: 'https://books.example.com/' },
      })
    }
  })

  it('a bad key fails, marks hosting failed, and no post carries a credential', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Za-z0-9]{20,30}$/),
        fc.stringMatching(/^[A-Za-z0-9/+=]{40,50}$/),
        async (accessKeyId, secretAccessKey) => {
          const credentials = { ...CREDENTIALS, accessKeyId, secretAccessKey }
          const factory = await connected(credentials)
          const r2 = createFakeR2()
          r2.setOverride((method) =>
            method === 'PUT' ? s3Error(403, 'InvalidAccessKeyId') : undefined,
          )
          const publishRequest = request('book-a')

          const posts = await run(publishRequest, factory, r2)

          expect(posts.at(-1)?.message).toEqual({
            failed: {
              code: 'key',
              status: 403,
              message:
                "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token.",
              sent: 0,
              total: expect.any(Number),
            },
          })
          expect(await createCredentialStore(factory).loadStatus()).toEqual({
            checkedAtMs: NOW.getTime(),
            ok: false,
            code: 'key',
            message: expect.any(String),
          })
          const wire = JSON.stringify([publishRequest, ...posts])
          expect(wire).not.toContain(secretAccessKey)
          expect(wire).not.toContain(accessKeyId)
        },
      ),
      { numRuns: 5 },
    )
  })

  it('a 503 failure leaves the hosting status unchanged', async () => {
    const factory = await connected()
    const store = createCredentialStore(factory)
    await store.saveStatus({ checkedAtMs: 1, ok: true })
    const r2 = createFakeR2()
    r2.setOverride((method) =>
      method === 'PUT' ? new Response(null, { status: 503 }) : undefined,
    )

    const posts = await run(request(), factory, r2)

    expect(posts.at(-1)?.message).toMatchObject({
      failed: { code: 'other', status: 503, sent: 0 },
    })
    expect(await store.loadStatus()).toEqual({ checkedAtMs: 1, ok: true })
  })

  it('fails as unconnected with no stored credentials, before any request', async () => {
    const r2 = createFakeR2()

    const posts = await run(request(), new IDBFactory(), r2)

    expect(posts.at(-1)?.message).toEqual({
      failed: {
        code: 'unconnected',
        message: 'Connect hosting in Settings → Hosting first.',
        sent: 0,
        total: 0,
      },
    })
    expect(r2.events).toEqual([])
  })

  it('fails as render when the site cannot be built', async () => {
    const broken = request()
    const posts = await run(
      { input: { ...broken.input, revisions: null as never } },
      await connected(),
    )

    expect(posts.at(-1)?.message).toEqual({
      failed: {
        code: 'render',
        message: "Couldn't build the site. Try again.",
        sent: 0,
        total: 0,
      },
    })
  })

  it('fails as other when the credential store breaks', async () => {
    const broken = {
      open: () => {
        throw new Error('blocked')
      },
    } as unknown as IDBFactory

    const posts = await run(request(), broken)

    expect(posts.at(-1)?.message).toEqual({
      failed: {
        code: 'other',
        message: 'Something went wrong. Try again.',
        sent: 0,
        total: 0,
      },
    })
  })
})

describe('publish worker scope', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'postMessage')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('runs a posted request with the global store on the performance clock', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.stubGlobal('indexedDB', new IDBFactory())
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

    handler?.({ data: request() } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenLastCalledWith({
        failed: expect.objectContaining({ code: 'unconnected' }),
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

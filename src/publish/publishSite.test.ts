import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import {
  CREDENTIALS,
  createFakeR2,
  createFakeSleep,
  decodeText,
  s3Error,
  type StoredObject,
} from './fakeR2.test-helpers'
import {
  CACHE_IMMUTABLE,
  CACHE_NO_CACHE,
  CACHE_NO_STORE,
  cacheControlOf,
  contentTypeOf,
  parseManifest,
  PUBLISH_MANIFEST_KEY,
  publishSite,
  type PublishDeps,
  type PublishProgress,
  type PublishSiteFile,
} from './publishSite'
import { sha256Hex } from './r2Sign'
import { fileKind } from './uploadPlan'

const HASH = 'a'.repeat(64)
const NOW = new Date('2026-11-13T10:00:00Z')

async function siteFile(key: string, text: string): Promise<PublishSiteFile> {
  const bytes = new TextEncoder().encode(text)
  return { key, bytes, sha256: await sha256Hex(bytes) }
}

const SITE: readonly [string, string][] = [
  [`assets/${'1'.repeat(64)}.webp`, 'photo-1'],
  [`assets/${'2'.repeat(64)}.webp`, 'photo-2'],
  ['viewer/app.js', 'js'],
  ['site.json', '{}'],
  ['books/0123456789abcdef/index.html', '<p>book'],
  ['index.html', '<p>home'],
]

const siteFiles = (entries: readonly (readonly [string, string])[] = SITE) =>
  Promise.all(entries.map(([key, text]) => siteFile(key, text)))

function manifestObject(files: Record<string, string>): StoredObject {
  return {
    bytes: new TextEncoder().encode(JSON.stringify({ v: 1, files })),
    headers: {},
  }
}

function storedManifest(r2: ReturnType<typeof createFakeR2>): unknown {
  return JSON.parse(decodeText(r2.objects.get(PUBLISH_MANIFEST_KEY)?.bytes))
}

function deps(
  r2: ReturnType<typeof createFakeR2>,
  sleep = createFakeSleep().sleep,
  online = true,
): PublishDeps {
  return { fetch: r2.fetch, now: () => NOW, sleep, isOnline: () => online }
}

describe('publishSite: plan and order', () => {
  it('puts every file of a first publish, then the manifest, and links the book', async () => {
    const r2 = createFakeR2()
    const files = await siteFiles()

    const result = await publishSite(
      {
        files,
        credentials: CREDENTIALS,
        bookPath: 'books/0123456789abcdef/',
      },
      deps(r2),
    )

    expect(result).toEqual({
      ok: true,
      uploaded: 6,
      bytes: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
      removed: 0,
      unchanged: 0,
      bookUrl: 'https://books.example.com/books/0123456789abcdef/',
    })
    const requests = r2.requests()
    expect(requests[0]).toBe(`GET ${PUBLISH_MANIFEST_KEY}`)
    expect(requests.at(-1)).toBe(`PUT ${PUBLISH_MANIFEST_KEY}`)
    expect(storedManifest(r2)).toEqual({
      v: 1,
      files: Object.fromEntries(files.map((file) => [file.key, file.sha256])),
    })
    expect(decodeText(r2.objects.get('index.html')?.bytes)).toBe('<p>home')
  })

  it('an empty book path links the site home', async () => {
    const r2 = createFakeR2()

    const result = await publishSite(
      {
        files: await siteFiles(),
        credentials: { ...CREDENTIALS, publicBaseUrl: 'https://x.example///' },
        bookPath: '',
      },
      deps(r2),
    )

    expect(result).toMatchObject({ ok: true, bookUrl: 'https://x.example/' })
  })

  it('a second publish puts only the changed file and deletes only manifest keys', async () => {
    const r2 = createFakeR2({
      '_photobooks/check-0badf00d.txt': {
        bytes: new Uint8Array(),
        headers: {},
      },
      'keep/mine.txt': { bytes: new Uint8Array(), headers: {} },
    })
    const first = await siteFiles()
    await publishSite(
      { files: first, credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )
    r2.events.length = 0
    const second = await siteFiles([
      ...SITE.filter(([key]) => !key.endsWith('2'.repeat(64) + '.webp')),
    ])
    const changed = await siteFile('index.html', '<p>home v2')
    const files = second.map((file) =>
      file.key === 'index.html' ? changed : file,
    )

    const result = await publishSite(
      { files, credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )

    expect(result).toMatchObject({
      ok: true,
      uploaded: 1,
      removed: 1,
      unchanged: 4,
    })
    expect(r2.requests()).toEqual([
      `GET ${PUBLISH_MANIFEST_KEY}`,
      'PUT index.html',
      `DELETE assets/${'2'.repeat(64)}.webp`,
      `PUT ${PUBLISH_MANIFEST_KEY}`,
    ])
    expect(r2.objects.has('_photobooks/check-0badf00d.txt')).toBe(true)
    expect(r2.objects.has('keep/mine.txt')).toBe(true)
  })

  it('any files over any manifest: bucket ends equal, 4 in flight, groups never overlap, manifest last', async () => {
    const keyArb = fc.oneof(
      fc.stringMatching(/^[0-9a-f]{64}$/).map((hash) => `assets/${hash}.webp`),
      fc.stringMatching(/^[a-z]{1,6}$/).map((name) => `data/${name}.json`),
      fc.stringMatching(/^[a-z]{1,6}$/).map((name) => `p/${name}.html`),
    )
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(keyArb, { maxLength: 14 }),
        fc.uniqueArray(keyArb, { maxLength: 8 }),
        fc.boolean(),
        async (localKeys, remoteKeys, sameContent) => {
          const files = await siteFiles(localKeys.map((key) => [key, key]))
          const initial: Record<string, StoredObject> = {
            'outside/kept.txt': { bytes: new Uint8Array(), headers: {} },
          }
          const remoteHashes: Record<string, string> = {}
          for (const key of remoteKeys) {
            initial[key] = { bytes: new Uint8Array(), headers: {} }
            remoteHashes[key] = sameContent
              ? await sha256Hex(new TextEncoder().encode(key))
              : HASH
          }
          initial[PUBLISH_MANIFEST_KEY] = manifestObject(remoteHashes)
          const r2 = createFakeR2(initial)

          const result = await publishSite(
            { files, credentials: CREDENTIALS, bookPath: '' },
            deps(r2),
          )

          expect(result.ok).toBe(true)
          expect(r2.maxInFlight).toBeLessThanOrEqual(4)
          expect(r2.requests().at(-1)).toBe(`PUT ${PUBLISH_MANIFEST_KEY}`)
          expect(r2.objects.has('outside/kept.txt')).toBe(true)
          for (const event of r2.events) {
            if (event.method === 'DELETE') {
              expect(remoteKeys).toContain(event.key)
            }
          }
          expect(storedManifest(r2)).toEqual({
            v: 1,
            files: Object.fromEntries(
              files.map((file) => [file.key, file.sha256]),
            ),
          })
          // Group barrier: a put of a later kind starts only after every
          // put of an earlier kind has ended.
          const order = ['asset', 'json', 'html']
          const puts = r2.events.filter(
            (event) =>
              event.method === 'PUT' && event.key !== PUBLISH_MANIFEST_KEY,
          )
          puts.forEach((event, index) => {
            if (event.type !== 'start') return
            const rank = order.indexOf(fileKind(event.key))
            const pendingEarlier = puts
              .slice(index)
              .some(
                (later) =>
                  later.type === 'end' &&
                  order.indexOf(fileKind(later.key)) < rank,
              )
            expect(pendingEarlier).toBe(false)
          })
        },
      ),
      { numRuns: 25 },
    )
  })

  it('reports upload bytes, then finish by request', async () => {
    const r2 = createFakeR2({
      [PUBLISH_MANIFEST_KEY]: manifestObject({ 'old.html': HASH }),
    })
    const files = await siteFiles(SITE.slice(0, 2))
    const progress: PublishProgress[] = []

    await publishSite(
      {
        files,
        credentials: CREDENTIALS,
        bookPath: '',
        onProgress: (step) => progress.push(step),
      },
      deps(r2),
    )

    expect(progress).toEqual([
      { phase: 'upload', done: 0, total: 14 },
      { phase: 'upload', done: 7, total: 14 },
      { phase: 'upload', done: 14, total: 14 },
      { phase: 'finish', done: 0, total: 2 },
      { phase: 'finish', done: 1, total: 2 },
      { phase: 'finish', done: 2, total: 2 },
    ])
  })
})

describe('publishSite: P4 retry', () => {
  it.each([500, 503, 408])(
    'retries %i after 1 s and 3 s, then succeeds',
    async (status) => {
      const r2 = createFakeR2()
      const fake = createFakeSleep()
      let failures = 0
      r2.setOverride((method, key) => {
        if (method !== 'PUT' || key !== 'index.html' || failures === 2) return
        failures += 1
        return new Response(null, { status })
      })

      const result = await publishSite(
        { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
        deps(r2, fake.sleep),
      )

      expect(result.ok).toBe(true)
      expect(fake.waits).toEqual([1_000, 3_000])
      expect(r2.requests().filter((r) => r === 'PUT index.html')).toHaveLength(
        3,
      )
    },
  )

  it.each([
    [429, '2', 2_000],
    [429, '60', 10_000],
    [429, '0', 0],
    [429, 'soon', 1_000],
    [429, '-1', 1_000],
    [429, '1.5', 1_000],
    [503, '2', 1_000],
  ])(
    'a %i with Retry-After %s waits %i ms (429 only, capped at 10 s)',
    async (status, retryAfter, wait) => {
      const r2 = createFakeR2()
      const fake = createFakeSleep()
      let sent = false
      r2.setOverride((method) => {
        if (method !== 'GET' || sent) return
        sent = true
        return s3Error(status, 'SlowDown', { 'retry-after': retryAfter })
      })

      const result = await publishSite(
        { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
        deps(r2, fake.sleep),
      )

      expect(result.ok).toBe(true)
      expect(fake.waits).toEqual([wait])
    },
  )

  it('puts at most 4 at a time and starts no new put after a failure', async () => {
    const assets = Array.from(
      { length: 6 },
      (_, i) =>
        [`assets/${String(i).repeat(64)}.webp`, `photo-${String(i)}`] as const,
    )
    const healthy = createFakeR2()

    await publishSite(
      {
        files: await siteFiles(assets),
        credentials: CREDENTIALS,
        bookPath: '',
      },
      deps(healthy),
    )

    expect(healthy.maxInFlight).toBe(4)

    const r2 = createFakeR2()
    r2.setOverride((method, key) =>
      method === 'PUT' && key === assets[0]?.[0]
        ? s3Error(403, 'AccessDenied')
        : undefined,
    )

    const result = await publishSite(
      {
        files: await siteFiles(assets),
        credentials: CREDENTIALS,
        bookPath: '',
      },
      deps(r2),
    )

    expect(result).toMatchObject({ ok: false, code: 'denied', sent: 3 })
    const puts = r2.requests().filter((r) => r.startsWith('PUT assets/'))
    expect(puts).toHaveLength(4)
  })

  it('a put answered 404 NoSuchKey fails as other', async () => {
    const r2 = createFakeR2()
    r2.setOverride((method, key) =>
      method === 'PUT' && key === 'index.html'
        ? s3Error(404, 'NoSuchKey')
        : undefined,
    )

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )

    expect(result).toMatchObject({ ok: false, code: 'other', status: 404 })
  })

  it('reads navigator.onLine by default', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fake = createFakeSleep()
    try {
      const result = await publishSite(
        { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
        {
          fetch: () => Promise.reject(new TypeError('Failed to fetch')),
          now: () => NOW,
          sleep: fake.sleep,
        },
      )

      expect(result).toMatchObject({ ok: false, code: 'cors' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('honours 429 Retry-After on a put', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    let sent = false
    r2.setOverride((method) => {
      if (method !== 'PUT' || sent) return
      sent = true
      return s3Error(429, 'SlowDown', { 'retry-after': '2' })
    })

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep),
    )

    expect(result.ok).toBe(true)
    expect(fake.waits).toEqual([2_000])
  })

  it('503 ×3 fails with x of y, writes the partial manifest, and a retry sends only the rest', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    const failing = `assets/${'2'.repeat(64)}.webp`
    r2.setOverride((method, key) =>
      method === 'PUT' && key === failing
        ? new Response(null, { status: 503 })
        : undefined,
    )
    const files = await siteFiles()

    const failed = await publishSite(
      { files, credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep),
    )

    expect(failed).toEqual({
      ok: false,
      code: 'other',
      status: 503,
      message: 'Cloudflare answered 503. Check the values and try again.',
      sent: 2,
      total: 6,
    })
    expect(r2.requests().filter((r) => r === `PUT ${failing}`)).toHaveLength(3)
    // The json / html groups never started.
    expect(r2.objects.has('site.json')).toBe(false)
    expect(r2.objects.has('index.html')).toBe(false)
    expect(storedManifest(r2)).toEqual({
      v: 1,
      files: {
        [`assets/${'1'.repeat(64)}.webp`]: files[0]?.sha256,
        'viewer/app.js': files[2]?.sha256,
      },
    })

    r2.setOverride(undefined)
    r2.events.length = 0
    const retried = await publishSite(
      { files, credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep),
    )

    expect(retried).toMatchObject({ ok: true, uploaded: 4, unchanged: 2 })
    expect(r2.requests()).not.toContain(`PUT assets/${'1'.repeat(64)}.webp`)
    expect(r2.requests()).not.toContain('PUT viewer/app.js')
  })

  it.each([
    [403, 'InvalidAccessKeyId', 'key'],
    [403, 'AccessDenied', 'denied'],
    [404, 'NoSuchBucket', 'bucket'],
  ] as const)('%i %s fails as %s without a retry', async (status, s3, code) => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    r2.setOverride(() => s3Error(status, s3))

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep),
    )

    expect(result).toMatchObject({ ok: false, code, status, sent: 0, total: 0 })
    expect(fake.waits).toEqual([])
    // The manifest GET failed: nothing else was sent, no manifest written.
    expect(r2.requests()).toEqual([`GET ${PUBLISH_MANIFEST_KEY}`])
  })

  it('a key failure mid-run stops and tries the partial manifest once', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    r2.setOverride((method) =>
      method === 'PUT' ? s3Error(403, 'InvalidAccessKeyId') : undefined,
    )

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep),
    )

    expect(result).toMatchObject({ ok: false, code: 'key', sent: 0, total: 6 })
    expect(fake.waits).toEqual([])
    expect(
      r2.requests().filter((r) => r === `PUT ${PUBLISH_MANIFEST_KEY}`),
    ).toHaveLength(1)
    expect(JSON.stringify(result)).not.toContain(CREDENTIALS.secretAccessKey)
    expect(JSON.stringify(result)).not.toContain(CREDENTIALS.accessKeyId)
  })

  it('a failed final manifest PUT is not written twice', async () => {
    const r2 = createFakeR2()
    r2.setOverride((method, key) =>
      method === 'PUT' && key === PUBLISH_MANIFEST_KEY
        ? s3Error(403, 'AccessDenied')
        : undefined,
    )

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )

    expect(result).toMatchObject({ ok: false, code: 'denied', sent: 6 })
    expect(
      r2.requests().filter((r) => r === `PUT ${PUBLISH_MANIFEST_KEY}`),
    ).toHaveLength(1)
  })

  it('a network error while online is retried, then reads as cors', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    r2.setOverride(() => {
      throw new TypeError('Failed to fetch')
    })

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep, true),
    )

    expect(result).toMatchObject({ ok: false, code: 'cors' })
    expect(fake.waits).toEqual([1_000, 3_000])
  })

  it('offline is not retried', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep()
    r2.setOverride(() => {
      throw new TypeError('Failed to fetch')
    })

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep, false),
    )

    expect(result).toMatchObject({ ok: false, code: 'offline' })
    expect(fake.waits).toEqual([])
  })

  it('a request over 30 s is aborted and retried, then fails as timeout', async () => {
    const r2 = createFakeR2()
    const fake = createFakeSleep(true)
    r2.setOverride(
      (_method, _key, init) =>
        new Promise((_resolve, reject) => {
          const abort = () => {
            reject(new DOMException('aborted', 'AbortError'))
          }
          if (init.signal?.aborted === true) abort()
          init.signal?.addEventListener('abort', abort)
        }),
    )

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2, fake.sleep, false),
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'timeout',
      message: "Cloudflare didn't answer in 30 seconds. Try again.",
    })
    expect(fake.waits).toEqual([1_000, 3_000])
  })

  it('a delete of a key already gone counts as done', async () => {
    const r2 = createFakeR2({
      [PUBLISH_MANIFEST_KEY]: manifestObject({ 'gone.html': HASH }),
    })
    r2.setOverride((method) =>
      method === 'DELETE' ? s3Error(404, 'NoSuchKey') : undefined,
    )

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )

    expect(result).toMatchObject({ ok: true, removed: 1 })
  })

  it('an unexpected error fails as other without leaking', async () => {
    const r2 = createFakeR2()

    const result = await publishSite(
      {
        files: await siteFiles(),
        credentials: { ...CREDENTIALS, accountId: 'not-an-account' },
        bookPath: '',
      },
      deps(r2),
    )

    expect(result).toEqual({
      ok: false,
      code: 'other',
      message: 'Something went wrong. Try again.',
      sent: 0,
      total: 0,
    })
  })

  it('runs on the default clock and sleep', async () => {
    const r2 = createFakeR2()

    const result = await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      { fetch: r2.fetch },
    )

    expect(result.ok).toBe(true)
  })
})

describe('publishSite: P6 headers', () => {
  it.each([
    [`assets/${'f'.repeat(64)}.webp`, CACHE_IMMUTABLE, 'image/webp'],
    [
      'viewer/chunk-0123456789abcdef.js',
      CACHE_IMMUTABLE,
      'text/javascript; charset=utf-8',
    ],
    ['viewer/app.js', CACHE_NO_CACHE, 'text/javascript; charset=utf-8'],
    ['viewer/fonts.css', CACHE_NO_CACHE, 'text/css; charset=utf-8'],
    [
      'books/0123456789abcdef/index.html',
      CACHE_NO_CACHE,
      'text/html; charset=utf-8',
    ],
    [
      'books/0123456789abcdef0123/data.json',
      CACHE_NO_CACHE,
      'application/json',
    ],
    ['viewer/font.WOFF2', CACHE_NO_CACHE, 'font/woff2'],
    ['viewer/app.js.map', CACHE_NO_CACHE, 'application/json'],
    ['data/0123456789abcdef.json', CACHE_NO_CACHE, 'application/json'],
    ['books/0123456789abcdef/cover.webp', CACHE_NO_CACHE, 'image/webp'],
    ['README', CACHE_NO_CACHE, 'application/octet-stream'],
    [PUBLISH_MANIFEST_KEY, CACHE_NO_STORE, 'application/json'],
  ])('%s → %s, %s', (key, cache, type) => {
    expect(cacheControlOf(key)).toBe(cache)
    expect(contentTypeOf(key)).toBe(type)
  })

  it('stores each object with its signed Cache-Control and Content-Type', async () => {
    const r2 = createFakeR2()

    await publishSite(
      { files: await siteFiles(), credentials: CREDENTIALS, bookPath: '' },
      deps(r2),
    )

    for (const [key, object] of r2.objects) {
      expect(object.headers['cache-control']).toBe(cacheControlOf(key))
      expect(object.headers['content-type']).toBe(contentTypeOf(key))
      expect(object.headers.authorization).toContain('cache-control;')
    }
  })
})

describe('parseManifest', () => {
  it('reads v1 files and drops foreign, unsafe or malformed entries', () => {
    expect(
      parseManifest(
        JSON.stringify({
          v: 1,
          files: {
            'index.html': HASH,
            '_photobooks/check-1.txt': HASH,
            'a/../b.html': HASH,
            'a//b.html': HASH,
            'short.html': 'abc',
            'long.html': `${HASH}a`,
            'lead.html': `a${HASH}`,
            'upper.html': HASH.toUpperCase(),
            'list.html': [HASH],
            'n.json': 7,
          },
        }),
      ),
    ).toEqual({ 'index.html': HASH })
  })

  it.each([
    '',
    'not json',
    '[]',
    'null',
    `{"v":2,"files":{"index.html":"${HASH}"}}`,
    '{"v":1}',
    '{"v":1,"files":null}',
    `{"v":1,"files":["${HASH}"]}`,
  ])('%j reads as empty', (text) => {
    expect(parseManifest(text)).toEqual({})
  })
})

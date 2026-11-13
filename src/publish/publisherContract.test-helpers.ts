import { describe, expect, it } from 'vitest'
import type { Publisher, PublishProgress, PublishSiteFile } from './publisher'
import { sha256Hex } from './r2Sign'

interface StoredSiteObject {
  bytes: Uint8Array
  cacheControl: string | undefined
}

/** One fresh, empty target per test. */
export interface ContractTarget {
  publisher: Publisher
  /** Site files on the target now; the target's own bookkeeping keys left out. */
  stored: () => ReadonlyMap<string, StoredSiteObject>
  /** Most requests the target saw in flight at once. */
  maxInFlight: () => number
  /** The public URL of a site-root-relative path. */
  urlOf: (path: string) => string
}

const IMMUTABLE = /\bimmutable\b/
const HASH_HEX = 'c'.repeat(64)
const encoder = new TextEncoder()

async function siteFile(key: string, text: string): Promise<PublishSiteFile> {
  const bytes = encoder.encode(text)
  return { key, bytes, sha256: await sha256Hex(bytes) }
}

function site(): Promise<PublishSiteFile[]> {
  return Promise.all([
    siteFile('index.html', '<h1>home</h1>'),
    siteFile('books/a/index.html', '<h1>a</h1>'),
    siteFile('books/a/book.json', '{"a":1}'),
    siteFile(`photos/${HASH_HEX}.webp`, 'webp bytes'),
    siteFile('viewer/assets/index-B1c2D3e4.js', 'export {}'),
    siteFile('viewer/site.css', 'body{}'),
  ])
}

/** Every publish target runs this suite; `makeTarget` builds one over its fake. */
export function describePublisherContract(
  name: string,
  makeTarget: () => ContractTarget,
): void {
  describe(`Publisher contract: ${name}`, () => {
    it('puts every file of a first publish and links the book page', async () => {
      const target = makeTarget()
      const files = await site()

      const result = await target.publisher.publish({
        files,
        bookPath: 'books/a/',
      })

      expect(result).toEqual({
        ok: true,
        uploaded: files.length,
        bytes: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
        removed: 0,
        unchanged: 0,
        bookUrl: target.urlOf('books/a/'),
      })
      expect(
        new Map(
          [...target.stored()].map(([key, object]) => [key, object.bytes]),
        ),
      ).toEqual(new Map(files.map((file) => [file.key, file.bytes])))
    })

    it('sends nothing again for an unchanged site', async () => {
      const target = makeTarget()
      const files = await site()
      await target.publisher.publish({ files, bookPath: '' })

      const again = await target.publisher.publish({ files, bookPath: '' })

      expect(again).toMatchObject({
        ok: true,
        uploaded: 0,
        bytes: 0,
        removed: 0,
        unchanged: files.length,
        bookUrl: target.urlOf(''),
      })
    })

    it('puts only changed files and removes dropped ones when it deletes', async () => {
      const target = makeTarget()
      const files = await site()
      await target.publisher.publish({ files, bookPath: '' })
      const changed = await siteFile('index.html', '<h1>home v2</h1>')
      // Drops the home (replaced by `changed`) and the last file, `viewer/site.css`.
      const kept = files.slice(1, -1)

      const result = await target.publisher.publish({
        files: [changed, ...kept],
        bookPath: '',
      })

      const { deletes } = target.publisher.capabilities
      expect(result).toMatchObject({
        ok: true,
        uploaded: 1,
        removed: deletes ? 1 : 0,
        unchanged: kept.length,
      })
      expect(target.stored().get('index.html')?.bytes).toEqual(changed.bytes)
      expect(target.stored().has('viewer/site.css')).toBe(!deletes)
    })

    it('marks only content-hashed assets immutable, as its capability says', async () => {
      const target = makeTarget()
      const files = await site()
      await target.publisher.publish({ files, bookPath: '' })

      const immutable = [...target.stored()]
        .filter(([, object]) => IMMUTABLE.test(object.cacheControl ?? ''))
        .map(([key]) => key)
        .sort()

      expect(immutable).toEqual(
        target.publisher.capabilities.immutableCache
          ? [`photos/${HASH_HEX}.webp`, 'viewer/assets/index-B1c2D3e4.js']
          : [],
      )
    })

    it('keeps uploads within maxParallelUploads', async () => {
      const target = makeTarget()
      const files = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          siteFile(
            `photos/${String(index).padStart(64, 'a')}.webp`,
            String(index),
          ),
        ),
      )

      await target.publisher.publish({ files, bookPath: '' })

      const limit = target.publisher.capabilities.maxParallelUploads
      expect(limit).toBeGreaterThanOrEqual(1)
      expect(target.maxInFlight()).toBeLessThanOrEqual(limit)
    })

    it('reports upload bytes, then finish steps, each ending at its total', async () => {
      const target = makeTarget()
      const files = await site()
      const progress: PublishProgress[] = []

      await target.publisher.publish({
        files,
        bookPath: '',
        onProgress: (step) => progress.push(step),
      })

      const uploads = progress.filter((step) => step.phase === 'upload')
      const finishes = progress.filter((step) => step.phase === 'finish')
      expect(uploads.at(-1)).toEqual({
        phase: 'upload',
        done: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
        total: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
      })
      expect(finishes.at(-1)?.done).toBe(finishes.at(-1)?.total)
      const phases = progress.map((step) => step.phase)
      expect(phases.indexOf('finish')).toBeGreaterThan(
        phases.lastIndexOf('upload'),
      )
    })

    it('passes a connection check and leaves the site as it was', async () => {
      const target = makeTarget()
      const files = await site()
      await target.publisher.publish({ files, bookPath: '' })
      const before = target.stored()

      const checked = await target.publisher.check('recheck')

      expect(checked).toEqual({ ok: true })
      expect(target.stored()).toEqual(before)
    })
  })
}

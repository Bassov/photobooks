import { fc, test } from '@fast-check/vitest'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { buildSiteTree } from '../site/export'
import {
  createMemorySiteDirectory,
  snapshotSiteDirectory,
} from '../site/export/memorySiteDirectory.test-helpers'
import {
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
} from '../site/export/siteExport.test-helpers'
import { writeSiteTree } from '../site/export/writeSiteTree'
import { createCredentialStore, type R2Credentials } from './credentials'

/** Owner's security requirement: the token never reaches the personal site. */
const PBT_RUNS = { numRuns: 200 }
const PBT_TIMEOUT_MS = 60_000

const credentials: fc.Arbitrary<R2Credentials> = fc.record({
  accountId: fc.stringMatching(/^[0-9a-f]{32}$/),
  bucket: fc.constant('my-site'),
  accessKeyId: fc.stringMatching(/^[A-Za-z0-9]{20,64}$/),
  secretAccessKey: fc.stringMatching(/^[A-Za-z0-9/+=]{40,128}$/),
  publicBaseUrl: fc.constant('https://photos.example.com'),
})

const latin1 = new TextDecoder('latin1')

function base64(text: string): string {
  return btoa(text).replace(/=+$/, '')
}

/** Raw, URL-encoded, base64 (any alignment) and JSON-escaped forms of `secret`. */
function forms(secret: string): string[] {
  return [
    secret,
    encodeURIComponent(secret),
    JSON.stringify(secret).slice(1, -1),
    base64(secret),
    // Base64 of the secret embedded at byte offset 1 / 2: drop the mixed chars.
    base64(`a${secret}`).slice(2),
    base64(`ab${secret}`).slice(3),
  ]
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const PHOTOS = [1, 2].map(photoHash)

describe('token leak guard (PBT)', () => {
  test.prop([credentials, fc.string({ maxLength: 12 })], PBT_RUNS)(
    'no exported site file contains the access key id or secret',
    async (stored, title) => {
      await createCredentialStore().save(stored)
      expect(await createCredentialStore().load()).toEqual(stored)
      const { meta, revisions } = publishAll([
        makePhotoBook('bk-1', title, [PHOTOS]),
      ])
      const tree = await buildSiteTree({
        meta,
        revisions,
        derivatives: PHOTOS.flatMap((hash) => derivativesFor(hash)),
        site: { title, url: stored.publicBaseUrl },
        viewer: {
          entry: 'site.js',
          files: [{ path: 'site.js', bytes: new TextEncoder().encode('0') }],
        },
      })
      const folder = createMemorySiteDirectory()
      expect((await writeSiteTree(folder.root, tree)).ok).toBe(true)
      const written = await snapshotSiteDirectory(folder.root)
      const exported = [
        ...tree.files.map((file) => file.bytes),
        ...written.flatMap(([, bytes]) => (bytes === 'dir' ? [] : [bytes])),
      ].map((bytes) => latin1.decode(bytes))
      expect(exported.length).toBeGreaterThan(0)

      for (const needle of [
        ...forms(stored.accessKeyId),
        ...forms(stored.secretAccessKey),
      ]) {
        for (const text of exported) {
          expect(text.includes(needle)).toBe(false)
        }
      }
    },
    PBT_TIMEOUT_MS,
  )
})

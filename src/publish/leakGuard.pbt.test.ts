import { fc, test } from '@fast-check/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { HostingSection } from '../editor/HostingSection'
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
import { createCfApi } from './cfApi'
import { createCredentialStore, type R2Credentials } from './credentials'
import {
  ACCOUNT,
  createFakeCloudflare,
  dumpIndexedDb,
} from './fakeCloudflare.test-helpers'
import { s3Error } from './fakeR2.test-helpers'
import {
  bucketNameFor,
  discover,
  runSetup,
  type RowState,
  type SetupPlan,
} from './provision'

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

  test.prop(
    [
      fc.stringMatching(/^[A-Za-z0-9_-]{40,80}$/),
      fc.constantFrom('success', 'failure', 'cancel', 'token-left'),
    ],
    { numRuns: 60 },
  )(
    'the setup token never reaches IndexedDB, localStorage, the URL or logs',
    async (token, outcome) => {
      const logged = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
        (method) => vi.spyOn(console, method),
      )
      const cf = createFakeCloudflare()
      const controller = new AbortController()
      cf.setOverride((call) => {
        if (outcome === 'cancel' && call.path.endsWith('/cors')) {
          controller.abort()
        }
        if (outcome === 'token-left' && call.method === 'DELETE') {
          return Response.json(
            { success: false, errors: [{ code: 1, message: token }] },
            { status: 500 },
          )
        }
        return undefined
      })
      if (outcome === 'failure') {
        cf.r2.setOverride(() => s3Error(403, 'AccessDenied'))
      }
      const api = createCfApi(token, { fetch: cf.fetch, isOnline: () => true })
      const found = await discover(api)
      if (!found.ok) throw new Error(found.code)
      const zone = found.zonesByAccount[ACCOUNT]?.[0]
      if (zone === undefined) throw new Error('no zone')
      const host = `books.${zone.name}`
      const plan: SetupPlan = {
        api,
        tokenId: found.tokenId,
        bucketWriteGroupId: found.bucketWriteGroupId,
        accountId: found.defaultAccountId,
        zone,
        host,
        bucket: bucketNameFor(host),
        origin: location.origin,
        memory: {},
      }
      const states: RowState[] = []
      for await (const state of runSetup(plan, 1, {
        fetch: cf.fetch,
        isOnline: () => true,
        signal: controller.signal,
      })) {
        states.push(state)
      }

      const stored = await createCredentialStore().load()
      expect(stored !== undefined).toBe(
        outcome === 'success' || outcome === 'token-left',
      )
      expect(cf.calls.length).toBeGreaterThan(0)
      expect(
        cf.calls.every(
          (call) =>
            call.authorization === `Bearer ${token}` &&
            !call.path.includes(token),
        ),
      ).toBe(true)
      const places = [
        await dumpIndexedDb(indexedDB),
        JSON.stringify(
          Array.from({ length: localStorage.length }, (_, index) => {
            const key = localStorage.key(index) ?? ''
            return [key, localStorage.getItem(key)]
          }),
        ),
        location.href,
        JSON.stringify(logged.map((spy) => spy.mock.calls)),
        JSON.stringify(states),
        JSON.stringify(found),
        JSON.stringify(plan.memory),
      ]
      for (const needle of forms(token)) {
        for (const text of places) {
          expect(text.includes(needle)).toBe(false)
        }
      }
      for (const spy of logged) spy.mockRestore()
    },
    PBT_TIMEOUT_MS,
  )

  test.prop(
    [
      fc.stringMatching(/^[A-Za-z0-9_-]{40,80}$/),
      fc.constantFrom('success', 'failure', 'cancel'),
    ],
    { numRuns: 15 },
  )(
    'the guided setup card keeps the setup token out of the DOM and storage',
    async (token, outcome) => {
      const idb = new IDBFactory()
      vi.stubGlobal('indexedDB', idb)
      const cf = createFakeCloudflare()
      vi.stubGlobal('fetch', cf.fetch)
      const host = 'books.basov.photo'
      if (outcome !== 'success') cf.state.dnsTaken.add(host)
      const byId = (id: string) => screen.getByTestId(id)
      try {
        render(createElement(HostingSection, { row: '', rule: () => null }))
        fireEvent.change(await screen.findByTestId('hosting-setup-token'), {
          target: { value: token },
        })
        fireEvent.click(byId('hosting-setup-continue'))
        await screen.findByTestId('hosting-setup-host')
        fireEvent.click(byId('hosting-setup-run'))
        if (outcome === 'success') {
          await screen.findByTestId('hosting-connected')
        } else {
          await waitFor(() => {
            expect(byId('hosting-setup-retry')).toBeTruthy()
          })
          if (outcome === 'cancel') {
            fireEvent.click(byId('hosting-setup-cancel'))
          }
        }

        expect(
          cf.calls.every((call) => call.authorization === `Bearer ${token}`),
        ).toBe(true)
        const values = Array.from(
          document.querySelectorAll('input'),
          (field) => field.value,
        )
        const places = [
          document.documentElement.outerHTML,
          JSON.stringify(values),
          await dumpIndexedDb(idb),
          Object.keys(localStorage)
            .map((key) => `${key}=${localStorage.getItem(key) ?? ''}`)
            .join('\n'),
          location.href,
        ]
        for (const needle of forms(token)) {
          for (const text of places) {
            expect(text.includes(needle)).toBe(false)
          }
        }
      } finally {
        cleanup()
      }
    },
    PBT_TIMEOUT_MS,
  )
})

import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCfApi } from './cfApi'
import { createCredentialStore } from './credentials'
import {
  ACCOUNT,
  cfError,
  cfOk,
  createFakeCloudflare,
  SETUP_TOKEN,
  SETUP_TOKEN_ID,
  WRITE_GROUP,
  ZONE,
} from './fakeCloudflare.test-helpers'
import { s3Error } from './fakeR2.test-helpers'
import {
  bucketNameFor,
  deriveS3Keys,
  discover,
  runSetup,
  setupTemplateUrl,
  type RowState,
  type SetupDeps,
  type SetupPlan,
  type SetupRow,
} from './provision'
import { sha256Hex } from './r2Sign'

const NOW = new Date('2026-11-14T10:00:00Z')
const HOST = 'books.basov.photo'
const BUCKET = 'pb-books-basov-photo'

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  const cf = createFakeCloudflare()
  const factory = new IDBFactory()
  const api = createCfApi(SETUP_TOKEN, {
    fetch: cf.fetch,
    isOnline: () => true,
  })
  const plan: SetupPlan = {
    api,
    tokenId: SETUP_TOKEN_ID,
    bucketWriteGroupId: WRITE_GROUP,
    accountId: ACCOUNT,
    zone: ZONE,
    host: HOST,
    bucket: BUCKET,
    origin: 'https://photobooks.example',
    memory: {},
  }
  const deps: SetupDeps = {
    fetch: cf.fetch,
    isOnline: () => true,
    now: () => NOW,
    randomHex: () => '0badc0de',
    indexedDB: factory,
  }
  return { cf, api, plan, deps, factory }
}

async function collect(states: AsyncIterable<RowState>): Promise<RowState[]> {
  const seen: RowState[] = []
  for await (const state of states) seen.push(state)
  return seen
}

const doneRows = (rows: SetupRow[]): RowState[] =>
  rows.flatMap((row) => [
    { row, state: 'running' as const },
    { row, state: 'done' as const },
  ])

describe('setupTemplateUrl', () => {
  it('prefills the three permissions of the setup token', () => {
    const url = new URL(setupTemplateUrl())

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://dash.cloudflare.com/profile/api-tokens',
    )
    expect(
      JSON.parse(url.searchParams.get('permissionGroupKeys') ?? ''),
    ).toEqual([
      { key: 'workers_r2', type: 'edit' },
      { key: 'zone', type: 'read' },
      { key: 'api_tokens', type: 'edit' },
    ])
    expect(url.searchParams.get('accountId')).toBe('*')
    expect(url.searchParams.get('zoneId')).toBe('all')
    expect(url.searchParams.get('name')).toBe('Photobooks setup')
    expect(setupTemplateUrl()).toContain('&name=Photobooks%20setup')
  })
})

describe('bucketNameFor', () => {
  it('is pb- and the host with dots as hyphens', () => {
    expect(bucketNameFor('books.basov.photo')).toBe('pb-books-basov-photo')
    expect(bucketNameFor('Books.Example.COM')).toBe('pb-books-example-com')
    expect(bucketNameFor('xn--80ak6aa92e.com')).toBe('pb-xn--80ak6aa92e-com')
  })

  it('cuts to 63 and trims trailing hyphens', () => {
    const host = `${'a'.repeat(59)}.b.example.com`
    expect(bucketNameFor(host)).toBe(`pb-${'a'.repeat(59)}`)
    expect(bucketNameFor(`${'a'.repeat(60)}.example.com`)).toBe(
      `pb-${'a'.repeat(60)}`,
    )
  })

  it('falls back to pb-site when nothing of the host is left', () => {
    expect(bucketNameFor('')).toBe('pb-site')
    expect(bucketNameFor('...')).toBe('pb-site')
    expect(bucketNameFor('a')).toBe('pb-a')
  })
})

describe('deriveS3Keys', () => {
  it('is the token id and the SHA-256 hex of the token value (R2 docs)', async () => {
    expect(await deriveS3Keys('a'.repeat(32), 'abc')).toEqual({
      accessKeyId: 'a'.repeat(32),
      secretAccessKey:
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
  })
})

describe('discover', () => {
  it('lists accounts, active and pending zones, buckets and the write group', async () => {
    const { cf, api } = setup()
    cf.state.accounts.unshift({ id: 'b'.repeat(32), name: 'Pending only' })
    cf.state.zones['b'.repeat(32)] = [
      { id: 'z3', name: 'later.org', status: 'pending' },
      { id: 'z4', name: 'moved.org', status: 'moved' },
    ]
    cf.state.r2Off.add('b'.repeat(32))
    cf.state.buckets[ACCOUNT] = ['pb-old', BUCKET]

    expect(await discover(api)).toEqual({
      ok: true,
      tokenId: SETUP_TOKEN_ID,
      accounts: [
        { id: 'b'.repeat(32), name: 'Pending only' },
        { id: ACCOUNT, name: 'Aleksandr Basov' },
      ],
      zonesByAccount: {
        ['b'.repeat(32)]: [{ id: 'z3', name: 'later.org', status: 'pending' }],
        [ACCOUNT]: [ZONE, { id: 'z2', name: 'mybooks.org', status: 'pending' }],
      },
      bucketsByAccount: {
        ['b'.repeat(32)]: null,
        [ACCOUNT]: ['pb-old', BUCKET],
      },
      defaultAccountId: ACCOUNT,
      r2On: true,
      bucketWriteGroupId: WRITE_GROUP,
    })
    expect(cf.requests()).toEqual([
      'GET /user/tokens/verify',
      'GET /accounts',
      `GET /zones?account.id=${'b'.repeat(32)}&per_page=50`,
      `GET /accounts/${'b'.repeat(32)}/r2/buckets`,
      `GET /zones?account.id=${ACCOUNT}&per_page=50`,
      `GET /accounts/${ACCOUNT}/r2/buckets`,
      'GET /user/tokens/permission_groups',
    ])
    expect(
      cf.calls.every((call) => call.authorization === `Bearer ${SETUP_TOKEN}`),
    ).toBe(true)
  })

  it('reports R2 off (10042) and falls back to the first account', async () => {
    const { cf, api } = setup()
    cf.state.zones[ACCOUNT] = []
    cf.state.r2Off.add(ACCOUNT)

    expect(await discover(api)).toMatchObject({
      ok: true,
      r2On: false,
      defaultAccountId: ACCOUNT,
      bucketsByAccount: { [ACCOUNT]: null },
      zonesByAccount: { [ACCOUNT]: [] },
    })
  })

  it('skips malformed accounts, zones and buckets', async () => {
    const { cf, api } = setup()
    cf.setOverride((call) => {
      if (call.path === '/accounts') {
        return cfOk([
          { id: ACCOUNT, name: 'A' },
          { id: 1, name: 'B' },
          { id: 'c' },
        ])
      }
      if (call.path.startsWith('/zones')) {
        return cfOk([
          { id: 'z', name: 5, status: 'active' },
          { name: 'x', status: 'active' },
        ])
      }
      if (call.path.endsWith('/r2/buckets')) {
        return cfOk({ buckets: [{ name: 'ok-bucket' }, { name: 3 }] })
      }
      return undefined
    })

    expect(await discover(api)).toMatchObject({
      accounts: [{ id: ACCOUNT, name: 'A' }],
      zonesByAccount: { [ACCOUNT]: [] },
      bucketsByAccount: { [ACCOUNT]: ['ok-bucket'] },
    })
    cf.setOverride((call) =>
      call.path === '/accounts' ? cfOk({ not: 'a list' }) : undefined,
    )
    expect(await discover(api)).toMatchObject({ code: 'no-account' })
    cf.setOverride((call) =>
      call.path.endsWith('/r2/buckets') ? cfOk(null) : undefined,
    )
    expect(await discover(api)).toMatchObject({
      bucketsByAccount: { [ACCOUNT]: [] },
    })
  })

  const rejected = {
    ok: false,
    code: 'token-rejected',
    message:
      "Cloudflare doesn't accept this token. Copy it again, or create a new one from the link.",
  }

  it.each([
    ['verify 401', '/user/tokens/verify', cfError(401)],
    ['verify 403', '/user/tokens/verify', cfError(403)],
    ['verify 1000', '/user/tokens/verify', cfError(400, 1000)],
    ['verify 6003', '/user/tokens/verify', cfError(400, 6003)],
    ['verify 9109', '/user/tokens/verify', cfError(400, 9109)],
    [
      'an inactive token',
      '/user/tokens/verify',
      cfOk({ id: 'x', status: 'disabled' }),
    ],
    ['a verify without id', '/user/tokens/verify', cfOk({ status: 'active' })],
    ['accounts 403', '/accounts', cfError(403)],
    ['accounts 401', '/accounts', cfError(401)],
  ])('rejects the token on %s', async (_name, path, response) => {
    const { cf, api } = setup()
    cf.setOverride((call) =>
      call.path === path ? response.clone() : undefined,
    )

    expect(await discover(api)).toEqual(rejected)
  })

  it('names a token without accounts', async () => {
    const { cf, api } = setup()
    cf.state.accounts = []

    expect(await discover(api)).toEqual({
      ok: false,
      code: 'no-account',
      message:
        'This token has no account. Create it again from the link above.',
    })
  })

  it.each([
    ['/zones', cfError(403), 'Zone · Read'],
    ['/zones', cfError(401), 'Zone · Read'],
    ['/r2/buckets', cfError(403, 10000), 'Workers R2 Storage · Edit'],
    ['/permission_groups', cfError(403, 9109), 'API Tokens · Edit'],
    [
      '/permission_groups',
      cfOk([
        { id: 'x', name: 'Workers R2 Storage Read' },
        { name: 'Workers R2 Storage Bucket Item Write' },
      ]),
      'API Tokens · Edit',
    ],
  ])(
    'names the missing permission when %s answers no',
    async (part, response, missing) => {
      const { cf, api } = setup()
      cf.setOverride((call) =>
        call.path.includes(part) ? response.clone() : undefined,
      )

      expect(await discover(api)).toEqual({
        ok: false,
        code: 'missing-permission',
        missing,
        message: `This token is missing ${missing}. Create it again from the link above.`,
      })
    },
  )

  it.each([
    '/user/tokens/verify',
    '/accounts',
    '/zones',
    '/r2/buckets',
    '/permission_groups',
  ])('passes a server failure of %s on with its message', async (part) => {
    const { cf, api } = setup()
    cf.setOverride((call) =>
      call.path.startsWith(part) || call.path.endsWith(part)
        ? cfError(500, 7000)
        : undefined,
    )

    expect(await discover(api)).toEqual({
      ok: false,
      code: 'other',
      message: 'Cloudflare answered 500 7000. Check the values and try again.',
    })
  })
})

describe('runSetup', () => {
  it('provisions the six rows and stores a setup record', async () => {
    const { cf, plan, deps, factory } = setup()

    expect(await collect(runSetup(plan, 1, deps))).toEqual(
      doneRows([1, 2, 3, 4, 5, 6]),
    )

    const token = [...cf.state.tokens].at(-1) ?? ['', '']
    const keys = await deriveS3Keys(token[0], token[1])
    const store = createCredentialStore(factory)
    expect(await store.load()).toEqual({
      accountId: ACCOUNT,
      bucket: BUCKET,
      ...keys,
      publicBaseUrl: `https://${HOST}`,
    })
    expect(keys.secretAccessKey).toBe(await sha256Hex(token[1]))
    expect(await store.loadProvenance()).toEqual({
      origin: 'setup',
      provisionedAtMs: NOW.getTime(),
    })
    expect(plan.memory).toEqual({})
    expect(cf.state.tokens.has(SETUP_TOKEN_ID)).toBe(false)
    expect(cf.requests()).toEqual([
      `POST /accounts/${ACCOUNT}/r2/buckets`,
      `PUT /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/cors`,
      `POST /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/domains/custom`,
      'POST /user/tokens',
      `DELETE /user/tokens/${SETUP_TOKEN_ID}`,
    ])
    expect(cf.calls.map((call) => call.body)).toEqual([
      { name: BUCKET },
      {
        rules: [
          {
            allowed: {
              origins: ['https://photobooks.example'],
              methods: ['GET', 'HEAD', 'PUT', 'DELETE'],
              headers: ['*'],
            },
            exposeHeaders: ['ETag'],
            maxAgeSeconds: 3600,
          },
        ],
      },
      { domain: HOST, zoneId: ZONE.id, enabled: true },
      {
        name: `Photobooks · ${HOST}`,
        policies: [
          {
            effect: 'allow',
            permission_groups: [{ id: WRITE_GROUP }],
            resources: {
              [`com.cloudflare.edge.r2.bucket.${ACCOUNT}_default_${BUCKET}`]:
                '*',
            },
          },
        ],
      },
      undefined,
    ])
    expect(cf.r2.requests()).toHaveLength(3)
  })

  const ENDPOINTS: Record<SetupRow, string> = {
    1: `POST /accounts/${ACCOUNT}/r2/buckets`,
    2: `PUT /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/cors`,
    3: `POST /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/domains/custom`,
    4: 'POST /user/tokens',
    5: '(R2 check)',
    6: `DELETE /user/tokens/${SETUP_TOKEN_ID}`,
  }

  it.each([2, 3, 4, 5, 6] as const)(
    'resumes from row %i without calling earlier rows',
    async (from) => {
      const { cf, plan, deps, factory } = setup()
      cf.state.buckets[ACCOUNT] = [BUCKET]
      plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))

      const states = await collect(runSetup(plan, from, deps))

      const rows = ([1, 2, 3, 4, 5, 6] as const).filter((row) => row >= from)
      expect(states).toEqual(doneRows(rows))
      const requests = cf.requests()
      for (const row of [1, 2, 3, 4, 6] as const) {
        expect(requests.includes(ENDPOINTS[row])).toBe(row >= from)
      }
      expect(cf.r2.requests().length > 0).toBe(from <= 5)
      expect(
        await createCredentialStore(factory).loadProvenance(),
      ).toMatchObject({
        origin: 'setup',
      })
    },
  )

  it('goes on from row 4 when rows 5–6 have no keys', async () => {
    const { cf, plan, deps } = setup()

    const states = await collect(runSetup(plan, 6, deps))

    expect(states[0]).toEqual({ row: 4, state: 'running' })
    expect(cf.requests()[0]).toBe('POST /user/tokens')
  })

  it('counts an existing own bucket and an attached domain as done', async () => {
    const { cf, plan, deps } = setup()
    cf.state.buckets[ACCOUNT] = [BUCKET]
    cf.state.domains[BUCKET] = [HOST]

    expect(await collect(runSetup(plan, 1, deps))).toEqual(
      doneRows([1, 2, 3, 4, 5, 6]),
    )
    expect(cf.requests().slice(0, 5)).toEqual([
      `POST /accounts/${ACCOUNT}/r2/buckets`,
      `GET /accounts/${ACCOUNT}/r2/buckets`,
      `PUT /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/cors`,
      `POST /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/domains/custom`,
      `GET /accounts/${ACCOUNT}/r2/buckets/${BUCKET}/domains/custom`,
    ])
  })

  it('stops at a bucket name owned by another account', async () => {
    const { cf, plan, deps, factory } = setup()
    cf.state.foreign.add(BUCKET)

    expect(await collect(runSetup(plan, 1, deps))).toEqual([
      { row: 1, state: 'running' },
      {
        row: 1,
        state: 'failed',
        code: 'bucket-taken',
        message: `The bucket name ${BUCKET} is taken. Choose another address.`,
      },
    ])
    expect(await createCredentialStore(factory).load()).toBeUndefined()
  })

  it('fails row 1 on other answers', async () => {
    const { cf, plan, deps } = setup()
    cf.setOverride((call) =>
      call.method === 'POST' ? cfError(500, 7) : undefined,
    )
    expect((await collect(runSetup(plan, 1, deps))).at(-1)).toMatchObject({
      row: 1,
      state: 'failed',
      code: 'other',
      message: 'Cloudflare answered 500 7. Check the values and try again.',
    })

    cf.setOverride((call) =>
      call.method === 'POST' ? cfError(409, 10004) : cfError(500, 8),
    )
    expect((await collect(runSetup(plan, 1, deps))).at(-1)).toMatchObject({
      row: 1,
      code: 'other',
      message: 'Cloudflare answered 500 8. Check the values and try again.',
    })
  })

  it('fails row 2 when the CORS rule is refused', async () => {
    const { cf, plan, deps } = setup()
    cf.setOverride((call) =>
      call.method === 'PUT' ? cfError(403, 10000) : undefined,
    )

    expect((await collect(runSetup(plan, 2, deps))).at(-1)).toMatchObject({
      row: 2,
      state: 'failed',
      code: 'forbidden',
    })
  })

  it('names a DNS conflict, and Try again resumes at row 3', async () => {
    const { cf, plan, deps } = setup()
    cf.state.dnsTaken.add(HOST)

    const first = await collect(runSetup(plan, 1, deps))
    expect(first.at(-1)).toEqual({
      row: 3,
      state: 'failed',
      code: 'dns-conflict',
      message: `${HOST} already points somewhere else in your DNS. Choose another address, or delete that record in Cloudflare.`,
    })
    expect(first.some((state) => state.row === 4)).toBe(false)

    cf.state.dnsTaken.clear()
    cf.calls.length = 0
    expect(await collect(runSetup(plan, 3, deps))).toEqual(
      doneRows([3, 4, 5, 6]),
    )
    expect(cf.requests().some((request) => request.includes('/cors'))).toBe(
      false,
    )
    expect(cf.requests()).not.toContain(`POST /accounts/${ACCOUNT}/r2/buckets`)
  })

  it('names a DNS conflict by code 100117 at any status', async () => {
    const { cf, plan, deps } = setup()
    cf.setOverride((call) =>
      call.method === 'POST' && call.path.endsWith('/custom')
        ? cfError(400, 100117)
        : undefined,
    )
    expect((await collect(runSetup(plan, 3, deps))).at(-1)).toMatchObject({
      code: 'dns-conflict',
    })
  })

  it('fails row 3 on other answers and offline without listing', async () => {
    const { cf, plan, deps } = setup()
    cf.setOverride((call) =>
      call.path.endsWith('/custom') ? cfError(500, 9) : undefined,
    )
    expect((await collect(runSetup(plan, 3, deps))).at(-1)).toMatchObject({
      row: 3,
      code: 'other',
      message: 'Cloudflare answered 500 9. Check the values and try again.',
    })

    for (const offline of [true, false]) {
      cf.calls.length = 0
      const api = createCfApi(SETUP_TOKEN, {
        fetch: () => Promise.reject(new TypeError('x')),
        isOnline: () => !offline,
      })
      const states = await collect(runSetup({ ...plan, api }, 3, deps))
      expect(states.at(-1)).toMatchObject({
        row: 3,
        code: offline ? 'offline' : 'other',
      })
    }
  })

  it('stops at row 3 while the zone is not active, with no call', async () => {
    const { cf, plan, deps } = setup()
    plan.zone = { id: 'z2', name: 'mybooks.org', status: 'pending' }

    expect(await collect(runSetup(plan, 3, deps))).toEqual([
      { row: 3, state: 'running' },
      {
        row: 3,
        state: 'failed',
        code: 'zone-inactive',
        message:
          "mybooks.org isn't active in Cloudflare yet. Try again when it is.",
      },
    ])
    expect(cf.calls).toEqual([])
  })

  it.each([cfError(403), cfError(400, 9109), cfError(401)])(
    'says the token cannot create tokens when row 4 is refused',
    async (response) => {
      const { cf, plan, deps } = setup()
      cf.setOverride((call) =>
        call.path === '/user/tokens' ? response.clone() : undefined,
      )

      expect((await collect(runSetup(plan, 4, deps))).at(-1)).toEqual({
        row: 4,
        state: 'failed',
        code: 'cant-create-token',
        message:
          "This token can't create API tokens. Create it again from the link in step 1.",
      })
      expect(plan.memory.keys).toBeUndefined()
    },
  )

  it('fails row 4 on a server error or a token without a value', async () => {
    const { cf, plan, deps } = setup()
    cf.setOverride((call) =>
      call.path === '/user/tokens' ? cfError(500, 1) : undefined,
    )
    expect((await collect(runSetup(plan, 4, deps))).at(-1)).toMatchObject({
      code: 'other',
      message: 'Cloudflare answered 500 1. Check the values and try again.',
    })

    for (const result of [{ id: 'x' }, { value: 'y' }]) {
      cf.setOverride((call) =>
        call.path === '/user/tokens' ? cfOk(result) : undefined,
      )
      expect((await collect(runSetup(plan, 4, deps))).at(-1)).toEqual({
        row: 4,
        state: 'failed',
        code: 'other',
        message: 'Something went wrong. Try again.',
      })
    }
  })

  /** A virtual clock moved only by setup's waits (WebCrypto signing runs off the timer queue). */
  function virtualClock() {
    const clock = { ms: 0, waits: [] as number[] }
    const sleep = (ms: number) => {
      clock.ms += ms
      clock.waits.push(ms)
      return Promise.resolve()
    }
    return { clock, sleep }
  }

  it('retries a CORS failure every 5 s and passes once the rule applies', async () => {
    const { cf, plan, deps } = setup()
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))
    const { clock, sleep } = virtualClock()
    const puts: number[] = []
    cf.r2.setOverride((method) => {
      if (method !== 'PUT') return undefined
      puts.push(clock.ms)
      if (puts.length <= 3) throw new TypeError('Failed to fetch')
      return undefined
    })

    expect(await collect(runSetup(plan, 5, { ...deps, sleep }))).toEqual(
      doneRows([5, 6]),
    )
    expect(puts).toEqual([0, 5_000, 10_000, 15_000])
  })

  it('gives up on CORS after 30 s and keeps the record unstored', async () => {
    const { cf, plan, deps, factory } = setup()
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))
    const { clock, sleep } = virtualClock()
    const puts: number[] = []
    cf.r2.setOverride((method) => {
      if (method === 'PUT') puts.push(clock.ms)
      throw new TypeError('Failed to fetch')
    })

    const states = await collect(runSetup(plan, 5, { ...deps, sleep }))

    expect(puts).toEqual([0, 5_000, 10_000, 15_000, 20_000, 25_000, 30_000])
    expect(clock.waits).toEqual(Array<number>(6).fill(5_000))
    expect(states.at(-1)).toEqual({
      row: 5,
      state: 'failed',
      code: 'cors-pending',
      message:
        "Cloudflare hasn't applied the upload rule yet. Try again in a minute.",
    })
    expect(await createCredentialStore(factory).load()).toBeUndefined()
    expect(plan.memory.keys).toBeDefined()
  })

  it('reports a key failure of the check write without retrying', async () => {
    const { cf, plan, deps } = setup()
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))
    const sleep = vi.fn(() => Promise.resolve())
    cf.r2.setOverride(() => s3Error(403, 'InvalidAccessKeyId'))

    const last = (await collect(runSetup(plan, 5, { ...deps, sleep }))).at(-1)

    expect(last).toMatchObject({ row: 5, state: 'failed', code: 'key' })
    expect(last?.state === 'failed' ? last.message : '').toContain(
      "Cloudflare doesn't recognise this key",
    )
    expect(sleep).not.toHaveBeenCalled()
  })

  it('stores the record with setupTokenLeft when deleting the setup token fails', async () => {
    const { cf, plan, deps, factory } = setup()
    cf.setOverride((call) =>
      call.method === 'DELETE' ? cfError(500, 1) : undefined,
    )

    const states = await collect(runSetup(plan, 1, deps))

    expect(states.slice(-2)).toEqual([
      { row: 6, state: 'running' },
      { row: 6, state: 'warning' },
    ])
    expect(await loadProvenance(factory)).toEqual({
      origin: 'setup',
      provisionedAtMs: NOW.getTime(),
      setupTokenLeft: true,
    })
  })

  it('counts a setup token that is gone already as deleted', async () => {
    const { cf, plan, deps, factory } = setup()
    cf.state.tokens.delete(SETUP_TOKEN_ID)
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))

    expect(await collect(runSetup(plan, 6, deps))).toEqual(doneRows([6]))
    expect(await loadProvenance(factory)).toEqual({
      origin: 'setup',
      provisionedAtMs: NOW.getTime(),
    })
  })

  it('fails row 6 when the record cannot be stored, keeping the keys', async () => {
    const { plan, deps } = setup()
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))
    const broken = {
      open: () => {
        throw new Error('blocked')
      },
    } as unknown as IDBFactory

    expect(
      (await collect(runSetup(plan, 6, { ...deps, indexedDB: broken }))).at(-1),
    ).toEqual({
      row: 6,
      state: 'failed',
      code: 'storage',
      message: "Couldn't keep the key on this computer. Try again.",
    })
    expect(plan.memory.keys).toBeDefined()
  })

  it('stops between calls when cancelled, without a failed row', async () => {
    const { cf, plan, deps, factory } = setup()
    const controller = new AbortController()
    cf.setOverride((call) => {
      if (call.path.endsWith('/cors')) controller.abort()
      return undefined
    })

    const states = await collect(
      runSetup(plan, 1, { ...deps, signal: controller.signal }),
    )

    expect(states).toEqual([...doneRows([1]), { row: 2, state: 'running' }])
    expect(cf.requests()).toHaveLength(2)
    expect(await createCredentialStore(factory).load()).toBeUndefined()
  })

  it('does not start when cancelled already', async () => {
    const { cf, plan, deps } = setup()
    expect(
      await collect(
        runSetup(plan, 1, { ...deps, signal: AbortSignal.abort() }),
      ),
    ).toEqual([])
    expect(cf.calls).toEqual([])
  })

  it('stops the CORS wait when cancelled', async () => {
    const { cf, plan, deps } = setup()
    plan.memory.keys = await deriveS3Keys('c'.repeat(32), 'v'.repeat(40))
    const controller = new AbortController()
    let puts = 0
    cf.r2.setOverride((method) => {
      if (method === 'PUT') puts += 1
      throw new TypeError('Failed to fetch')
    })
    const sleep = () => {
      controller.abort()
      return Promise.resolve()
    }

    expect(
      await collect(
        runSetup(plan, 5, { ...deps, sleep, signal: controller.signal }),
      ),
    ).toEqual([{ row: 5, state: 'running' }])
    expect(puts).toBe(1)
  })
})

function loadProvenance(factory: IDBFactory) {
  return createCredentialStore(factory).loadProvenance()
}

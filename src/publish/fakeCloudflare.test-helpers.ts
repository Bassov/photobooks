import { createFakeR2 } from './fakeR2.test-helpers'

export const SETUP_TOKEN = 'SetupTok_en-0123456789abcdefghijKLMNOPQRS'
export const SETUP_TOKEN_ID = 'f'.repeat(32)
export const ACCOUNT = '0123456789abcdef0123456789abcdef'
export const WRITE_GROUP = 'grp-bucket-item-write'
export const ZONE = { id: 'z1', name: 'basov.photo', status: 'active' } as const

/** Cloudflare v4 envelopes. */
export const cfOk = (result: unknown, status = 200) =>
  Response.json({ success: true, errors: [], result }, { status })

export const cfError = (status: number, code?: number) =>
  Response.json(
    {
      success: false,
      errors: code === undefined ? [] : [{ code, message: 'nope' }],
      result: null,
    },
    { status },
  )

export interface CfCall {
  method: string
  path: string
  authorization: string | null
  body: unknown
}

/** Return a response (or throw) to replace the default answer for one call. */
export type CfOverride = (call: CfCall) => Response | undefined

interface CfState {
  accounts: { id: string; name: string }[]
  zones: Record<string, { id: string; name: string; status: string }[]>
  buckets: Record<string, string[]>
  r2Off: Set<string>
  /** Bucket → attached hosts. */
  domains: Record<string, string[]>
  /** Hosts with a DNS record already. */
  dnsTaken: Set<string>
  /** Bucket names owned by another account. */
  foreign: Set<string>
  tokens: Map<string, string>
}

/**
 * The `/api/cf/*` relay over an in-memory Cloudflare account, with R2 (direct)
 * from `createFakeR2` behind the same `fetch`.
 */
export function createFakeCloudflare() {
  const state: CfState = {
    accounts: [{ id: ACCOUNT, name: 'Aleksandr Basov' }],
    zones: {
      [ACCOUNT]: [ZONE, { id: 'z2', name: 'mybooks.org', status: 'pending' }],
    },
    buckets: { [ACCOUNT]: [] },
    r2Off: new Set(),
    domains: {},
    dnsTaken: new Set(),
    foreign: new Set(),
    tokens: new Map([[SETUP_TOKEN_ID, SETUP_TOKEN]]),
  }
  const calls: CfCall[] = []
  const r2 = createFakeR2()
  let override: CfOverride | undefined
  let nextToken = 0

  const route = (call: CfCall): Response => {
    const { method, path } = call
    const url = new URL(path, 'https://relay.test')
    const parts = url.pathname.split('/').slice(1)
    const body = call.body as Record<string, unknown> | undefined
    // `accounts/:a/r2/buckets/:b/…` without the ids.
    const shape = parts.filter(
      (_, index) => parts[0] !== 'accounts' || (index !== 1 && index !== 4),
    )
    const key = `${method} ${shape.join('/')}`
    const account = parts[1] ?? ''
    const bucket = parts[4] ?? ''
    switch (key) {
      case 'GET user/tokens/verify':
        return cfOk({ id: SETUP_TOKEN_ID, status: 'active' })
      case 'GET accounts':
        return cfOk(state.accounts)
      case 'GET zones':
        return cfOk(state.zones[url.searchParams.get('account.id') ?? ''] ?? [])
      case 'GET accounts/r2/buckets':
        return state.r2Off.has(account)
          ? cfError(403, 10042)
          : cfOk({
              buckets: (state.buckets[account] ?? []).map((name) => ({
                name,
              })),
            })
      case 'POST accounts/r2/buckets': {
        const name = String(body?.name)
        const owned = state.buckets[account] ?? []
        if (owned.includes(name) || state.foreign.has(name)) {
          return cfError(409, 10004)
        }
        state.buckets[account] = [...owned, name]
        return cfOk({ name })
      }
      case 'PUT accounts/r2/buckets/cors':
        return cfOk({})
      case 'GET accounts/r2/buckets/domains/custom':
        return cfOk({
          domains: (state.domains[bucket] ?? []).map((domain) => ({ domain })),
        })
      case 'POST accounts/r2/buckets/domains/custom': {
        const domain = String(body?.domain)
        if (state.dnsTaken.has(domain)) return cfError(409, 100117)
        if ((state.domains[bucket] ?? []).includes(domain)) {
          return cfError(409, 100117)
        }
        state.domains[bucket] = [...(state.domains[bucket] ?? []), domain]
        return cfOk({ domain, enabled: true })
      }
      case 'GET user/tokens/permission_groups':
        return cfOk([
          { id: 'grp-other', name: 'Workers R2 Storage Read' },
          { id: WRITE_GROUP, name: 'Workers R2 Storage Bucket Item Write' },
        ])
      case 'POST user/tokens': {
        nextToken += 1
        const id = String(nextToken).padStart(32, 'a')
        const value = `bucketKeyValue${String(nextToken)}`.padEnd(40, 'x')
        state.tokens.set(id, value)
        return cfOk({ id, value }, 201)
      }
      default:
        if (method === 'DELETE' && parts[0] === 'user') {
          return state.tokens.delete(parts[2] ?? '')
            ? cfOk({ id: parts[2] })
            : cfError(404, 1003)
        }
        return cfError(404, 7003)
    }
  }

  const fetch = async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString()
    if (!url.startsWith('/api/cf/')) return r2.fetch(input, init)
    const headers = new Headers(init.headers)
    const call: CfCall = {
      method: init.method ?? 'GET',
      path: url.slice('/api/cf'.length),
      authorization: headers.get('Authorization'),
      body:
        typeof init.body === 'string'
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    }
    calls.push(call)
    await Promise.resolve()
    return override?.(call) ?? route(call)
  }

  return {
    state,
    calls,
    r2,
    fetch,
    setOverride(next: CfOverride | undefined) {
      override = next
    },
    /** `METHOD path` of every relay call, in order. */
    requests: () => calls.map((call) => `${call.method} ${call.path}`),
  }
}

/** Every value of every store of every database of `factory`, as JSON. */
export async function dumpIndexedDb(factory: IDBFactory): Promise<string> {
  const dumps: unknown[] = []
  for (const { name } of await factory.databases()) {
    if (name === undefined) continue
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open(name)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
    for (const store of Array.from(db.objectStoreNames)) {
      const all = db.transaction(store).objectStore(store).getAll()
      dumps.push(
        await new Promise((resolve) => {
          all.onsuccess = () => {
            resolve(all.result)
          }
        }),
      )
    }
    db.close()
  }
  return JSON.stringify(dumps)
}

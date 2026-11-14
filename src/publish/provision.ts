/**
 * Guided hosting setup over an injected `CfApi` (Designer Spec
 * connect-own-hosting § Core, C2, C7–C10): the setup-token template link,
 * discovery, and six idempotent, resumable rows that end with a stored
 * bucket-scoped key. The setup token is never stored; nothing is rolled back.
 */

import type { CfApi, CfErrorCode, CfFailure } from './cfApi'
import {
  createCredentialStore,
  type CheckCode,
  type R2Credentials,
} from './credentials'
import type { HostingDeps } from './hosting'
import { createPublisher } from './publisher'
import { defaultSleep } from './publishSite'
import { BUCKET_PATTERN, sha256Hex } from './r2Sign'

/** Workers R2 Storage · Edit, Zone · Read, API Tokens · Edit (C2). */
const PERMISSION_GROUP_KEYS = [
  { key: 'workers_r2', type: 'edit' },
  { key: 'zone', type: 'read' },
  { key: 'api_tokens', type: 'edit' },
]

/** Cloudflare's create-token form, prefilled with the three permissions. */
export function setupTemplateUrl(): string {
  const keys = encodeURIComponent(JSON.stringify(PERMISSION_GROUP_KEYS))
  return `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${keys}&accountId=*&zoneId=all&name=Photobooks%20setup`
}

const BUCKET_FALLBACK = 'pb-site'

/**
 * `pb-` + the host, lowercased, `.` and other non-name characters → `-`, cut
 * to 63 and trailing `-` trimmed (C7). Same host, same bucket.
 */
export function bucketNameFor(host: string): string {
  const name = `pb-${host.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
    .slice(0, 63)
    .replace(/-+$/, '')
  return BUCKET_PATTERN.test(name) ? name : BUCKET_FALLBACK
}

export interface S3Keys {
  accessKeyId: string
  secretAccessKey: string
}

/** R2 S3 keys of an API token: the token id and the SHA-256 hex of its value. */
export async function deriveS3Keys(
  tokenId: string,
  tokenValue: string,
): Promise<S3Keys> {
  return { accessKeyId: tokenId, secretAccessKey: await sha256Hex(tokenValue) }
}

interface CfAccount {
  id: string
  name: string
}

interface CfZone {
  id: string
  name: string
  status: 'active' | 'pending'
}

type SetupPermission =
  'Workers R2 Storage · Edit' | 'Zone · Read' | 'API Tokens · Edit'

export interface Discovery {
  ok: true
  /** The setup token's own id, for deleting it at the end. */
  tokenId: string
  accounts: CfAccount[]
  zonesByAccount: Record<string, CfZone[]>
  /** Bucket names per account; `null` where R2 is off. */
  bucketsByAccount: Record<string, string[] | null>
  /** The first account with an active zone, else the first. */
  defaultAccountId: string
  /** R2 is on in the default account. */
  r2On: boolean
  /** Permission group id of `Workers R2 Storage Bucket Item Write`. */
  bucketWriteGroupId: string
}

type DiscoverCode =
  'token-rejected' | 'missing-permission' | 'no-account' | CfErrorCode

export interface DiscoverFailure {
  ok: false
  code: DiscoverCode
  missing?: SetupPermission
  message: string
}

const REJECTED =
  "Cloudflare doesn't accept this token. Copy it again, or create a new one from the link."

function missing(permission: SetupPermission): DiscoverFailure {
  return {
    ok: false,
    code: 'missing-permission',
    missing: permission,
    message: `This token is missing ${permission}. Create it again from the link above.`,
  }
}

function passOn(failure: CfFailure): DiscoverFailure {
  return { ok: false, code: failure.code, message: failure.message }
}

/** A probe failure: a 401 / 403 names the permission it needed. */
function probeFailure(
  failure: CfFailure,
  permission: SetupPermission,
): DiscoverFailure {
  return failure.code === 'token' || failure.code === 'forbidden'
    ? missing(permission)
    : passOn(failure)
}

const BUCKET_WRITE = 'Workers R2 Storage Bucket Item Write'

interface Named {
  id?: unknown
  name?: unknown
  status?: unknown
}

const listOf = (value: unknown): Named[] =>
  Array.isArray(value) ? (value as Named[]) : []

/**
 * Verify the token, list its accounts, their active and pending zones and
 * buckets (R2 off = `null`), and find the bucket-item write permission group.
 */
export async function discover(
  api: CfApi,
): Promise<Discovery | DiscoverFailure> {
  const verify = await api.request<Named>('GET', '/user/tokens/verify')
  if (!verify.ok) {
    return verify.code === 'token' || verify.code === 'forbidden'
      ? { ok: false, code: 'token-rejected', message: REJECTED }
      : passOn(verify)
  }
  const { id: tokenId, status } = verify.result
  if (typeof tokenId !== 'string' || status !== 'active') {
    return { ok: false, code: 'token-rejected', message: REJECTED }
  }

  const listed = await api.request<unknown>('GET', '/accounts')
  if (!listed.ok) {
    return listed.code === 'token' || listed.code === 'forbidden'
      ? { ok: false, code: 'token-rejected', message: REJECTED }
      : passOn(listed)
  }
  const accounts = listOf(listed.result).flatMap((account) =>
    typeof account.id === 'string' && typeof account.name === 'string'
      ? [{ id: account.id, name: account.name }]
      : [],
  )
  const [firstAccount] = accounts
  if (firstAccount === undefined) {
    return {
      ok: false,
      code: 'no-account',
      message:
        'This token has no account. Create it again from the link above.',
    }
  }

  const zonesByAccount: Record<string, CfZone[]> = {}
  const bucketsByAccount: Record<string, string[] | null> = {}
  for (const account of accounts) {
    const zones = await api.request<unknown>(
      'GET',
      `/zones?account.id=${account.id}&per_page=50`,
    )
    if (!zones.ok) return probeFailure(zones, 'Zone · Read')
    zonesByAccount[account.id] = listOf(zones.result).flatMap((zone) =>
      typeof zone.id === 'string' &&
      typeof zone.name === 'string' &&
      (zone.status === 'active' || zone.status === 'pending')
        ? [{ id: zone.id, name: zone.name, status: zone.status }]
        : [],
    )
    const buckets = await api.request<{ buckets?: unknown }>(
      'GET',
      `/accounts/${account.id}/r2/buckets`,
    )
    if (!buckets.ok && buckets.code !== 'r2-off') {
      return probeFailure(buckets, 'Workers R2 Storage · Edit')
    }
    bucketsByAccount[account.id] = buckets.ok
      ? bucketNames(buckets.result)
      : null
  }

  const groups = await api.request<unknown>(
    'GET',
    '/user/tokens/permission_groups',
  )
  if (!groups.ok) return probeFailure(groups, 'API Tokens · Edit')
  const bucketWrite = listOf(groups.result).find(
    (group) => group.name === BUCKET_WRITE && typeof group.id === 'string',
  )
  if (bucketWrite === undefined) return missing('API Tokens · Edit')

  const defaultAccountId = (
    accounts.find((account) =>
      zonesByAccount[account.id]?.some((zone) => zone.status === 'active'),
    ) ?? firstAccount
  ).id
  return {
    ok: true,
    tokenId,
    accounts,
    zonesByAccount,
    bucketsByAccount,
    defaultAccountId,
    r2On: bucketsByAccount[defaultAccountId] !== null,
    bucketWriteGroupId: bucketWrite.id as string,
  }
}

function bucketNames(result: { buckets?: unknown } | null): string[] {
  return listOf(result?.buckets).flatMap((bucket) =>
    typeof bucket.name === 'string' ? [bucket.name] : [],
  )
}

export type SetupRow = 1 | 2 | 3 | 4 | 5 | 6

export interface SetupPlan {
  /** Bound to the setup token. */
  api: CfApi
  /** `discover().tokenId`. */
  tokenId: string
  /** `discover().bucketWriteGroupId`. */
  bucketWriteGroupId: string
  accountId: string
  zone: CfZone
  /** Site host, e.g. `books.basov.photo`. */
  host: string
  /** `bucketNameFor(host)`. */
  bucket: string
  /** Page origin the bucket's CORS rule allows (`location.origin`). */
  origin: string
  /** Kept between runs: the keys row 4 made, cleared once stored. */
  memory: { keys?: S3Keys }
}

export interface SetupDeps extends HostingDeps {
  /** Cancel: setup stops before its next call. */
  signal?: AbortSignal
}

type SetupFailureCode =
  | 'bucket-taken'
  | 'dns-conflict'
  | 'zone-inactive'
  | 'cant-create-token'
  | 'cors-pending'
  | 'storage'
  | CfErrorCode
  | CheckCode

export type RowState =
  | { row: SetupRow; state: 'running' | 'done' }
  /** Row 6 only: the setup token is left; setup still completes (C10). */
  | { row: SetupRow; state: 'warning' }
  | { row: SetupRow; state: 'failed'; code: SetupFailureCode; message: string }

type RowResult =
  | { ok: true; warning?: boolean }
  | { ok: false; code: SetupFailureCode; message: string }

const CORS_RETRY_MS = 5_000
const CORS_WAIT_MS = 30_000

const fail = (failure: CfFailure): RowResult => ({
  ok: false,
  code: failure.code,
  message: failure.message,
})

const bucketPath = (plan: SetupPlan) =>
  `/accounts/${plan.accountId}/r2/buckets/${plan.bucket}`

async function createBucket(plan: SetupPlan): Promise<RowResult> {
  const created = await plan.api.request(
    'POST',
    `/accounts/${plan.accountId}/r2/buckets`,
    { name: plan.bucket },
  )
  if (created.ok) return { ok: true }
  if (created.code !== 'conflict') return fail(created)
  // "Already exists": done when it is ours.
  const listed = await plan.api.request<{ buckets?: unknown }>(
    'GET',
    `/accounts/${plan.accountId}/r2/buckets`,
  )
  if (!listed.ok) return fail(listed)
  return bucketNames(listed.result).includes(plan.bucket)
    ? { ok: true }
    : {
        ok: false,
        code: 'bucket-taken',
        message: `The bucket name ${plan.bucket} is taken. Choose another address.`,
      }
}

async function allowUploads(plan: SetupPlan): Promise<RowResult> {
  // The publish-credentials CORS policy, in the Cloudflare API shape.
  const put = await plan.api.request('PUT', `${bucketPath(plan)}/cors`, {
    rules: [
      {
        allowed: {
          origins: [plan.origin],
          methods: ['GET', 'HEAD', 'PUT', 'DELETE'],
          headers: ['*'],
        },
        exposeHeaders: ['ETag'],
        maxAgeSeconds: 3600,
      },
    ],
  })
  return put.ok ? { ok: true } : fail(put)
}

const DNS_CONFLICT = 100117

async function connectDomain(plan: SetupPlan): Promise<RowResult> {
  if (plan.zone.status !== 'active') {
    return {
      ok: false,
      code: 'zone-inactive',
      message: `${plan.zone.name} isn't active in Cloudflare yet. Try again when it is.`,
    }
  }
  const path = `${bucketPath(plan)}/domains/custom`
  const attached = await plan.api.request('POST', path, {
    domain: plan.host,
    zoneId: plan.zone.id,
    enabled: true,
  })
  if (attached.ok) return { ok: true }
  if (attached.code === 'offline' || attached.code === 'timeout') {
    return fail(attached)
  }
  // "Already attached" to this bucket: done.
  const listed = await plan.api.request<{ domains?: unknown }>('GET', path)
  if (
    listed.ok &&
    listOf(listed.result.domains).some(
      (domain) => (domain as { domain?: unknown }).domain === plan.host,
    )
  ) {
    return { ok: true }
  }
  return attached.code === 'conflict' || attached.cfCode === DNS_CONFLICT
    ? {
        ok: false,
        code: 'dns-conflict',
        message: `${plan.host} already points somewhere else in your DNS. Choose another address, or delete that record in Cloudflare.`,
      }
    : fail(attached)
}

async function createKey(plan: SetupPlan): Promise<RowResult> {
  const created = await plan.api.request<{ id?: unknown; value?: unknown }>(
    'POST',
    '/user/tokens',
    {
      name: `Photobooks · ${plan.host}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: [{ id: plan.bucketWriteGroupId }],
          resources: {
            [`com.cloudflare.edge.r2.bucket.${plan.accountId}_default_${plan.bucket}`]:
              '*',
          },
        },
      ],
    },
  )
  if (!created.ok) {
    return created.code === 'token' || created.code === 'forbidden'
      ? {
          ok: false,
          code: 'cant-create-token',
          message:
            "This token can't create API tokens. Create it again from the link in step 1.",
        }
      : fail(created)
  }
  const { id, value } = created.result
  if (typeof id !== 'string' || typeof value !== 'string') {
    return {
      ok: false,
      code: 'other',
      message: 'Something went wrong. Try again.',
    }
  }
  plan.memory.keys = await deriveS3Keys(id, value)
  return { ok: true }
}

function credentialsOf(plan: SetupPlan, keys: S3Keys): R2Credentials {
  return {
    accountId: plan.accountId,
    bucket: plan.bucket,
    ...keys,
    publicBaseUrl: `https://${plan.host}`,
  }
}

/** The publish-credentials check; `cors` retried every 5 s for 30 s (C9). */
async function testUpload(
  plan: SetupPlan,
  keys: S3Keys,
  deps: SetupDeps,
): Promise<RowResult> {
  const sleep = deps.sleep ?? defaultSleep
  const publisher = createPublisher(credentialsOf(plan, keys), deps)
  let result = await publisher.check('connect')
  for (
    let waited = 0;
    !result.ok && result.code === 'cors' && waited < CORS_WAIT_MS;
    waited += CORS_RETRY_MS
  ) {
    await sleep(CORS_RETRY_MS)
    if (deps.signal?.aborted === true) break
    result = await publisher.check('connect')
  }
  if (result.ok) return { ok: true }
  return result.code === 'cors'
    ? {
        ok: false,
        code: 'cors-pending',
        message:
          "Cloudflare hasn't applied the upload rule yet. Try again in a minute.",
      }
    : { ok: false, code: result.code, message: result.message }
}

/** Delete the setup token (gone already = done), then store the record. */
async function finish(
  plan: SetupPlan,
  keys: S3Keys,
  deps: SetupDeps,
): Promise<RowResult> {
  const deleted = await plan.api.request(
    'DELETE',
    `/user/tokens/${plan.tokenId}`,
  )
  const left = !deleted.ok && deleted.status !== 404
  const now = deps.now ?? (() => new Date())
  try {
    await createCredentialStore(deps.indexedDB).save(
      credentialsOf(plan, keys),
      {
        origin: 'setup',
        provisionedAtMs: now().getTime(),
        ...(left ? { setupTokenLeft: true } : {}),
      },
    )
  } catch {
    return {
      ok: false,
      code: 'storage',
      message: "Couldn't keep the key on this computer. Try again.",
    }
  }
  delete plan.memory.keys
  return { ok: true, warning: left }
}

/** The row to run for `row` and its action: rows 5–6 without keys run 4. */
function rowAction(
  row: SetupRow,
  plan: SetupPlan,
  deps: SetupDeps,
): [SetupRow, () => Promise<RowResult>] {
  const keys = plan.memory.keys
  if (row === 5 && keys !== undefined) {
    return [5, () => testUpload(plan, keys, deps)]
  }
  if (row === 6 && keys !== undefined) {
    return [6, () => finish(plan, keys, deps)]
  }
  if (row === 1) return [1, () => createBucket(plan)]
  if (row === 2) return [2, () => allowUploads(plan)]
  if (row === 3) return [3, () => connectDomain(plan)]
  return [4, () => createKey(plan)]
}

/** `ROWS[row]` is the row after `row`. */
const ROWS: readonly SetupRow[] = [1, 2, 3, 4, 5, 6]

/**
 * Rows `from`…6 as `running` then `done` / `warning` / `failed`; stops at the
 * first failure (earlier rows stay done: "Try again" passes the failed row as
 * `from`) or, between calls, when `deps.signal` aborts. Rows 5–6 need the keys
 * of row 4: without them setup goes on from 4.
 */
export async function* runSetup(
  plan: SetupPlan,
  from: SetupRow,
  deps: SetupDeps,
): AsyncGenerator<RowState> {
  const cancelled = () => deps.signal?.aborted === true
  let next: SetupRow | undefined = from
  while (next !== undefined) {
    const [row, action] = rowAction(next, plan, deps)
    if (cancelled()) return
    yield { row, state: 'running' }
    const result = await action()
    if (cancelled()) return
    if (!result.ok) {
      yield { row, state: 'failed', code: result.code, message: result.message }
      return
    }
    yield { row, state: result.warning === true ? 'warning' : 'done' }
    next = ROWS[row]
  }
}

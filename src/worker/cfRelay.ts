/**
 * Stateless same-origin relay to the Cloudflare API for hosting setup
 * (api.cloudflare.com sends no CORS headers). It stores, logs and echoes
 * nothing from a request: only an exact method + path allowlist with closed
 * JSON bodies is forwarded, with the caller's `Authorization` and nothing else.
 */

export const RELAY_PREFIX = '/api/cf'
export const CF_API = 'https://api.cloudflare.com/client/v4'
export const MAX_BODY_BYTES = 16 * 1024
/** `Workers R2 Storage Bucket Item Write` (Cloudflare R2 docs, "Create API tokens via API"). */
export const BUCKET_ITEM_WRITE_GROUP_ID = '2efd5506f9c8494dacb1fa10a3e7d5b6'
const MAX_TOKEN_NAME = 120

export type Upstream = (url: string, init: RequestInit) => Promise<Response>

const HEX32 = '[0-9a-f]{32}'
const BUCKET = '[a-z0-9][a-z0-9-]{1,61}[a-z0-9]'
const HEX32_RE = new RegExp(`^${HEX32}$`)
const BUCKET_RE = new RegExp(`^${BUCKET}$`)
const BEARER_RE = /^Bearer [A-Za-z0-9_-]{20,200}$/
const TOKEN_RESOURCE_RE = new RegExp(
  `^com\\.cloudflare\\.edge\\.r2\\.bucket\\.${HEX32}_default_${BUCKET}$`,
)
const HEADER_NAME_RE = /^[A-Za-z0-9*_-]{1,128}$/
const RULE_ID_RE = /^[A-Za-z0-9 _.-]{1,64}$/
const DNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const TLD_RE = /^[a-z]{2,63}$/
const JSON_TYPE_RE = /^application\/json\s*(?:;|$)/i

type BodyKind = 'bucket' | 'cors' | 'domain' | 'token'

interface Route {
  method: string
  path: RegExp
  body?: BodyKind
  /** Allowed query keys and their value rules; no entry = no query at all. */
  query?: Readonly<Record<string, RegExp>>
  /** Forward only when the token's own verify call returns the path's `id`. */
  selfOnly?: true
}

const ZONES_QUERY = {
  'account.id': HEX32_RE,
  status: /^(?:active|pending|initializing|moved|deleted|deactivated)$/,
  per_page: /^[1-9][0-9]{0,2}$/,
  page: /^[1-9][0-9]{0,3}$/,
}

const BUCKETS = `/accounts/(?<a>${HEX32})/r2/buckets`
const ONE_BUCKET = `${BUCKETS}/(?<b>${BUCKET})`

const ROUTES: readonly Route[] = [
  { method: 'GET', path: /^\/user\/tokens\/verify$/ },
  { method: 'GET', path: /^\/accounts$/ },
  { method: 'GET', path: /^\/zones$/, query: ZONES_QUERY },
  { method: 'GET', path: new RegExp(`^${BUCKETS}$`) },
  { method: 'POST', path: new RegExp(`^${BUCKETS}$`), body: 'bucket' },
  { method: 'PUT', path: new RegExp(`^${ONE_BUCKET}/cors$`), body: 'cors' },
  { method: 'GET', path: new RegExp(`^${ONE_BUCKET}/domains/custom$`) },
  {
    method: 'POST',
    path: new RegExp(`^${ONE_BUCKET}/domains/custom$`),
    body: 'domain',
  },
  { method: 'GET', path: /^\/user\/tokens\/permission_groups$/ },
  { method: 'POST', path: /^\/user\/tokens$/, body: 'token' },
  {
    method: 'DELETE',
    path: new RegExp(`^/user/tokens/(?<id>${HEX32})$`),
    selfOnly: true,
  },
]

type RelayError =
  | 'forbidden_origin'
  | 'not_found'
  | 'unauthorized'
  | 'unsupported_media_type'
  | 'body_too_large'
  | 'bad_json'
  | 'body_rejected'
  | 'not_own_token'
  | 'upstream_failed'

const ERROR_STATUS: Readonly<Record<RelayError, number>> = {
  forbidden_origin: 403,
  not_found: 404,
  unauthorized: 401,
  unsupported_media_type: 415,
  body_too_large: 413,
  bad_json: 400,
  body_rejected: 403,
  not_own_token: 403,
  upstream_failed: 502,
}

const NO_STORE = 'no-store'
/**
 * Redirects come back as-is (their `Location` is dropped with every other
 * header), so the token never follows one. workerd has no `'error'` mode.
 */
const NO_FOLLOW: RequestRedirect = 'manual'

/** A fixed body per error: never built from request data. */
function relayError(code: RelayError): Response {
  return new Response(
    JSON.stringify({ success: false, errors: [{ code: `relay_${code}` }] }),
    {
      status: ERROR_STATUS[code],
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': NO_STORE,
      },
    },
  )
}

function isSameOrigin(request: Request, origin: string): boolean {
  return (
    request.headers.get('Origin') === origin &&
    request.headers.get('Sec-Fetch-Site') === 'same-origin'
  )
}

interface Match {
  route: Route
  path: string
  query: string
  params: Readonly<Record<string, string>>
}

function matchQuery(url: URL, allowed: Route['query']): string | null {
  if (url.search === '') return ''
  if (allowed === undefined) return null
  const out = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    const rule = allowed[key]
    if (rule === undefined || out.has(key) || !rule.test(value)) return null
    out.append(key, value)
  }
  return `?${out.toString()}`
}

function matchRoute(method: string, url: URL): Match | null {
  if (!url.pathname.startsWith(`${RELAY_PREFIX}/`)) return null
  const path = url.pathname.slice(RELAY_PREFIX.length)
  for (const route of ROUTES) {
    if (route.method !== method) continue
    const found = route.path.exec(path)
    if (found === null) continue
    const query = matchQuery(url, route.query)
    if (query === null) return null
    return { route, path, query, params: found.groups ?? {} }
  }
  return null
}

type BodyResult = { json: unknown } | { error: RelayError }

async function readJsonBody(request: Request): Promise<BodyResult> {
  if (!JSON_TYPE_RE.test(request.headers.get('Content-Type') ?? '')) {
    return { error: 'unsupported_media_type' }
  }
  if (request.body === null) return { error: 'bad_json' }
  const reader = request.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      return { error: 'body_too_large' }
    }
    chunks.push(value)
  }
  try {
    const bytes = await new Blob(chunks).arrayBuffer()
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { json: JSON.parse(text) as unknown }
  } catch {
    return { error: 'bad_json' }
  }
}

type Obj = Readonly<Record<string, unknown>>

/** A JSON object: not an array, null or a primitive. */
function isObj(value: unknown): value is Obj {
  return (
    (value as { constructor?: unknown } | null | undefined)?.constructor ===
    Object
  )
}

/** A JSON object with no key beyond `allowed`; callers type-check each key. */
function hasOnlyKeys(value: unknown, allowed: readonly string[]): value is Obj {
  return (
    isObj(value) && Object.keys(value).every((key) => allowed.includes(key))
  )
}

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return (allowed as readonly unknown[]).includes(value)
}

function isStringList(
  value: unknown,
  max: number,
  item: (entry: string) => boolean,
): boolean {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((entry) => typeof entry === 'string' && item(entry))
  )
}

function isHostname(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 253) return false
  const labels = value.split('.')
  const tld = labels.pop() ?? ''
  return (
    labels.length > 0 &&
    TLD_RE.test(tld) &&
    labels.every((label) => DNS_LABEL_RE.test(label))
  )
}

const LOCATION_HINTS = ['apac', 'eeur', 'enam', 'weur', 'wnam', 'oc']
const STORAGE_CLASSES = ['Standard', 'InfrequentAccess']
const CORS_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD']
const MIN_TLS = ['1.0', '1.1', '1.2', '1.3']

function isBucketBody(body: unknown): boolean {
  return (
    hasOnlyKeys(body, ['name', 'locationHint', 'storageClass']) &&
    typeof body.name === 'string' &&
    BUCKET_RE.test(body.name) &&
    (body.locationHint === undefined ||
      isOneOf(body.locationHint, LOCATION_HINTS)) &&
    (body.storageClass === undefined ||
      isOneOf(body.storageClass, STORAGE_CLASSES))
  )
}

function isCorsRule(rule: unknown, origin: string): boolean {
  if (!hasOnlyKeys(rule, ['allowed', 'id', 'exposeHeaders', 'maxAgeSeconds'])) {
    return false
  }
  const { allowed, id, exposeHeaders, maxAgeSeconds } = rule
  return (
    hasOnlyKeys(allowed, ['methods', 'origins', 'headers']) &&
    Array.isArray(allowed.origins) &&
    allowed.origins.length === 1 &&
    allowed.origins[0] === origin &&
    Array.isArray(allowed.methods) &&
    allowed.methods.length > 0 &&
    new Set(allowed.methods).size === allowed.methods.length &&
    allowed.methods.every((method) => isOneOf(method, CORS_METHODS)) &&
    (allowed.headers === undefined ||
      isStringList(allowed.headers, 20, (name) => HEADER_NAME_RE.test(name))) &&
    (id === undefined || (typeof id === 'string' && RULE_ID_RE.test(id))) &&
    (exposeHeaders === undefined ||
      isStringList(exposeHeaders, 20, (name) => HEADER_NAME_RE.test(name))) &&
    (maxAgeSeconds === undefined ||
      (Number.isInteger(maxAgeSeconds) &&
        (maxAgeSeconds as number) >= 0 &&
        (maxAgeSeconds as number) <= 86_400))
  )
}

function isCorsBody(body: unknown, origin: string): boolean {
  return (
    hasOnlyKeys(body, ['rules']) &&
    Array.isArray(body.rules) &&
    body.rules.length >= 1 &&
    body.rules.length <= 4 &&
    body.rules.every((rule) => isCorsRule(rule, origin))
  )
}

function isDomainBody(body: unknown): boolean {
  return (
    hasOnlyKeys(body, ['domain', 'zoneId', 'enabled', 'minTLS']) &&
    isHostname(body.domain) &&
    typeof body.zoneId === 'string' &&
    HEX32_RE.test(body.zoneId) &&
    typeof body.enabled === 'boolean' &&
    (body.minTLS === undefined || isOneOf(body.minTLS, MIN_TLS))
  )
}

/** Exactly one bucket-scoped write key: nothing broader passes. */
function isTokenPolicy(policy: unknown): boolean {
  if (!hasOnlyKeys(policy, ['effect', 'permission_groups', 'resources'])) {
    return false
  }
  const { effect, permission_groups: groups, resources } = policy
  if (effect !== 'allow' || !Array.isArray(groups) || groups.length !== 1) {
    return false
  }
  const [group] = groups as unknown[]
  if (!hasOnlyKeys(group, ['id']) || group.id !== BUCKET_ITEM_WRITE_GROUP_ID) {
    return false
  }
  if (!isObj(resources)) return false
  const [entry, ...rest] = Object.entries(resources)
  return (
    entry !== undefined &&
    rest.length === 0 &&
    TOKEN_RESOURCE_RE.test(entry[0]) &&
    entry[1] === '*'
  )
}

function isTokenBody(body: unknown): boolean {
  return (
    hasOnlyKeys(body, ['name', 'policies']) &&
    typeof body.name === 'string' &&
    body.name.length > 0 &&
    body.name.length <= MAX_TOKEN_NAME &&
    Array.isArray(body.policies) &&
    body.policies.length === 1 &&
    isTokenPolicy(body.policies[0])
  )
}

function isAllowedBody(kind: BodyKind, body: unknown, origin: string): boolean {
  switch (kind) {
    case 'bucket':
      return isBucketBody(body)
    case 'cors':
      return isCorsBody(body, origin)
    case 'domain':
      return isDomainBody(body)
    case 'token':
      return isTokenBody(body)
  }
}

async function isOwnToken(
  upstream: Upstream,
  authorization: string,
  id: string,
): Promise<boolean> {
  const response = await upstream(`${CF_API}/user/tokens/verify`, {
    method: 'GET',
    headers: { Authorization: authorization },
    redirect: NO_FOLLOW,
  })
  if (!response.ok) return false
  const json = (await response.json()) as unknown
  return isObj(json) && isObj(json.result) && json.result.id === id
}

const NULL_BODY_STATUS = new Set([101, 204, 205, 304])

/** Status + body only: `set-cookie`, `cf-*` and every other header are dropped. */
function relayResponse(upstream: Response): Response {
  const type = upstream.headers.get('Content-Type') ?? ''
  return new Response(
    NULL_BODY_STATUS.has(upstream.status) ? null : upstream.body,
    {
      status: upstream.status,
      headers: {
        'Content-Type': type.startsWith('application/json')
          ? type
          : 'text/plain; charset=utf-8',
        'Cache-Control': NO_STORE,
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

export async function handleCfRelay(
  request: Request,
  upstream: Upstream,
): Promise<Response> {
  const url = new URL(request.url)
  if (!isSameOrigin(request, url.origin)) return relayError('forbidden_origin')
  const match = matchRoute(request.method, url)
  if (match === null) return relayError('not_found')
  const authorization = request.headers.get('Authorization') ?? ''
  if (!BEARER_RE.test(authorization)) return relayError('unauthorized')

  const headers: Record<string, string> = { Authorization: authorization }
  let body: string | undefined
  if (match.route.body !== undefined) {
    const read = await readJsonBody(request)
    if ('error' in read) return relayError(read.error)
    if (!isAllowedBody(match.route.body, read.json, url.origin)) {
      return relayError('body_rejected')
    }
    // Forward what was checked, not the raw bytes (duplicate keys and the like).
    body = JSON.stringify(read.json)
    headers['Content-Type'] = 'application/json'
  }

  try {
    if (
      match.route.selfOnly === true &&
      !(await isOwnToken(upstream, authorization, match.params.id ?? ''))
    ) {
      return relayError('not_own_token')
    }
    const init: RequestInit = {
      method: match.route.method,
      headers,
      redirect: NO_FOLLOW,
    }
    if (body !== undefined) init.body = body
    return relayResponse(
      await upstream(`${CF_API}${match.path}${match.query}`, init),
    )
  } catch {
    return relayError('upstream_failed')
  }
}

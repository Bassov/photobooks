/**
 * AWS Signature Version 4 on WebCrypto, for the Cloudflare R2 S3 endpoint.
 * No dependency: HMAC-SHA256 and SHA-256 come from `crypto.subtle`.
 */

const encoder = new TextEncoder()

const ALGORITHM = 'AWS4-HMAC-SHA256'
const R2_REGION = 'auto'
const R2_SERVICE = 's3'

export interface SigV4Keys {
  accessKeyId: string
  secretAccessKey: string
}

export interface SigV4Request {
  method: string
  url: URL
  /** Headers to sign besides `host` (added from `url`); any name case. */
  headers: Readonly<Record<string, string>>
  /** Lowercase hex SHA-256 of the body. */
  payloadHash: string
  /** `YYYYMMDDTHHMMSSZ`; always sent as `x-amz-date` (overrides `headers`). */
  amzDate: string
  region: string
  service: string
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return hex(
    await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>),
  )
}

async function hmac(
  key: Uint8Array | ArrayBuffer,
  data: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

/** RFC 3986 encoding: everything but unreserved `A-Za-z0-9-._~`. */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** S3 canonical URI: each decoded path segment encoded once, `/` kept. */
function canonicalUri(url: URL): string {
  return url.pathname
    .split('/')
    .map((segment) => uriEncode(decodeURIComponent(segment)))
    .join('/')
}

/**
 * Encoded pairs sorted by name, then value. Encoded text never holds NUL, so
 * a plain sort of `name NUL value` orders by name first.
 */
function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([name, value]) => `${uriEncode(name)}\u0000${uriEncode(value)}`)
    .sort()
    .map((pair) => pair.replace('\u0000', '='))
    .join('&')
}

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
/** Set by the signer from `url` / the signature itself. */
const RESERVED_HEADERS = new Set(['host', 'authorization'])

/**
 * Signed headers for `request`: its own headers, `host`, `x-amz-date` and
 * `Authorization`. `host` is signed but left out of the result (`fetch` sets it).
 */
export async function signRequest(
  request: SigV4Request,
  keys: SigV4Keys,
): Promise<Record<string, string>> {
  const headers = new Map<string, string>()
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase()
    // An HTTP token only: `:` or a line break would forge canonical lines.
    if (!HEADER_NAME.test(name) || RESERVED_HEADERS.has(lower)) {
      throw new Error(`Invalid header name to sign: ${name}`)
    }
    headers.set(lower, value.trim().replace(/\s+/g, ' '))
  }
  headers.set('x-amz-date', request.amzDate)
  headers.set('host', request.url.host)
  const names = [...headers.keys()].sort()
  const signedHeaders = names.join(';')
  const canonicalRequest = [
    request.method,
    canonicalUri(request.url),
    canonicalQuery(request.url),
    ...names.map((name) => `${name}:${headers.get(name) ?? ''}`),
    '',
    signedHeaders,
    request.payloadHash,
  ].join('\n')
  const date = request.amzDate.slice(0, 8)
  const scope = `${date}/${request.region}/${request.service}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    request.amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')
  let key = await hmac(encoder.encode(`AWS4${keys.secretAccessKey}`), date)
  for (const part of [request.region, request.service, 'aws4_request']) {
    key = await hmac(key, part)
  }
  const signature = hex(await hmac(key, stringToSign))
  headers.delete('host')
  return {
    ...Object.fromEntries(headers),
    authorization: `${ALGORITHM} Credential=${keys.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

/** `YYYYMMDDTHHMMSSZ` in UTC. */
export function amzDate(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export interface R2Target extends SigV4Keys {
  accountId: string
  bucket: string
}

export interface R2RequestInput {
  method: 'PUT' | 'HEAD' | 'DELETE'
  /** Object key, `/`-separated, no leading `/`. */
  key: string
  /** PUT only. */
  body?: Uint8Array
  contentType?: string
  now: Date
}

export interface R2SignedRequest {
  method: R2RequestInput['method']
  url: string
  headers: Record<string, string>
}

/** Cloudflare account id: 32 lowercase hex. */
export const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/
/** R2 bucket name: 3–63 of `a-z 0-9 -`, letter or digit at both ends. */
export const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

/**
 * Object URL on the account's R2 S3 endpoint (path style). Throws on an
 * account id or bucket that could move the signed request to another host,
 * and on a key with an empty, `.` or `..` segment (it would leave the bucket).
 */
export function r2ObjectUrl(target: R2Target, key: string): URL {
  if (!ACCOUNT_ID_PATTERN.test(target.accountId)) {
    throw new Error('Invalid R2 account ID')
  }
  if (!BUCKET_PATTERN.test(target.bucket)) {
    throw new Error('Invalid R2 bucket name')
  }
  const segments = key.split('/')
  if (segments.some((segment) => ['', '.', '..'].includes(segment))) {
    throw new Error(`Invalid object key: ${key}`)
  }
  return new URL(
    `https://${target.accountId}.r2.cloudflarestorage.com/${target.bucket}/${segments.map(uriEncode).join('/')}`,
  )
}

/** A signed PUT / HEAD / DELETE ready for `fetch(url, { method, headers, body })`. */
export async function r2Request(
  target: R2Target,
  input: R2RequestInput,
): Promise<R2SignedRequest> {
  const url = r2ObjectUrl(target, input.key)
  const payloadHash = await sha256Hex(input.body ?? new Uint8Array())
  const headers: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
  }
  if (input.contentType !== undefined) {
    headers['content-type'] = input.contentType
  }
  return {
    method: input.method,
    url: url.href,
    headers: await signRequest(
      {
        method: input.method,
        url,
        headers,
        payloadHash,
        amzDate: amzDate(input.now),
        region: R2_REGION,
        service: R2_SERVICE,
      },
      target,
    ),
  }
}

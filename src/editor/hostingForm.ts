/**
 * Settings → Hosting form: pure parse, normalise and validation of the five
 * Cloudflare R2 fields. Messages name the rule and never echo a value.
 */

import type { R2Credentials } from '../publish/credentials'
import { BUCKET_PATTERN } from '../publish/r2Sign'

export type HostingField = keyof R2Credentials

/** Form order = Cloudflare's order. */
export const HOSTING_FIELDS: readonly HostingField[] = [
  'accountId',
  'bucket',
  'accessKeyId',
  'secretAccessKey',
  'publicBaseUrl',
]

export type HostingInput = Readonly<Record<HostingField, string>>

export const EMPTY_HOSTING_INPUT: HostingInput = {
  accountId: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  publicBaseUrl: '',
}

export const HOSTING_MESSAGES = {
  accountId: 'The account ID is 32 characters, 0–9 and a–f.',
  jurisdiction:
    "Buckets with a jurisdiction (EU, FedRAMP) aren't supported yet.",
  bucket: 'Bucket names are 3–63 characters: a–z, 0–9 and hyphens.',
  accessKeyId: 'The access key ID is 32 characters, 0–9 and a–f.',
  secretAccessKey: 'The secret is 64 characters, 0–9 and a–f.',
  http: 'Use https://.',
  path: 'Use the domain only, without a path.',
  r2dev: 'Use the custom domain. The r2.dev address is for testing only.',
  siteAddress: 'Enter a web address, like https://books.example.com.',
} as const

const HEX32 = /^[0-9a-f]{32}$/i
const HEX64 = /^[0-9a-f]{64}$/i
const ENDPOINT_HOST = /^([0-9a-f]{32})\.r2\.cloudflarestorage\.com$/
const JURISDICTION_HOST =
  /^[0-9a-f]{32}\.(?:eu|fedramp)\.r2\.cloudflarestorage\.com$/
const HOST_NAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

type EndpointParse =
  | { kind: 'endpoint'; accountId: string; bucket?: string }
  | { kind: 'jurisdiction' }
  | { kind: 'none' }

/** `https://<32 hex>.r2.cloudflarestorage.com[/<bucket>][/]`, nothing else. */
function parseEndpoint(value: string): EndpointParse {
  const url = parseUrl(value)
  if (url === undefined || /[?#]/.test(value)) return { kind: 'none' }
  if (JURISDICTION_HOST.test(url.hostname)) return { kind: 'jurisdiction' }
  const host = ENDPOINT_HOST.exec(url.hostname)
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    host === null
  ) {
    return { kind: 'none' }
  }
  const path = url.pathname.replace(/^\//, '').replace(/\/$/, '')
  if (path === '') return { kind: 'endpoint', accountId: host[1] ?? '' }
  return BUCKET_PATTERN.test(path)
    ? { kind: 'endpoint', accountId: host[1] ?? '', bucket: path }
    : { kind: 'none' }
}

/**
 * `input` with `field` set to `raw`, trimmed. A 32-hex account id is
 * lowercased; an S3 endpoint URL becomes its account id and its bucket fills
 * an empty Bucket.
 */
export function setHostingField(
  input: HostingInput,
  field: HostingField,
  raw: string,
): HostingInput {
  const value = raw.trim()
  if (field !== 'accountId') return { ...input, [field]: value }
  if (HEX32.test(value)) return { ...input, accountId: value.toLowerCase() }
  const endpoint = parseEndpoint(value)
  if (endpoint.kind !== 'endpoint') return { ...input, accountId: value }
  return {
    ...input,
    accountId: endpoint.accountId,
    bucket:
      input.bucket === '' && endpoint.bucket !== undefined
        ? endpoint.bucket
        : input.bucket,
  }
}

/**
 * Site address on blur: a bare host gets `https://`; a valid address becomes
 * `https://<lowercase host>` without the trailing `/`. Anything else is only
 * trimmed (its error stays visible).
 */
export function normaliseSiteAddress(raw: string): string {
  const value = raw.trim()
  if (value === '') return ''
  const withScheme = HAS_SCHEME.test(value) ? value : `https://${value}`
  return siteAddressError(withScheme) === undefined
    ? `https://${new URL(withScheme).hostname}`
    : withScheme
}

function siteAddressError(value: string): string | undefined {
  const url = parseUrl(HAS_SCHEME.test(value) ? value : `https://${value}`)
  if (url === undefined) return HOSTING_MESSAGES.siteAddress
  if (url.protocol === 'http:') return HOSTING_MESSAGES.http
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    !HOST_NAME.test(url.hostname)
  ) {
    return HOSTING_MESSAGES.siteAddress
  }
  if (url.hostname === 'r2.dev' || url.hostname.endsWith('.r2.dev')) {
    return HOSTING_MESSAGES.r2dev
  }
  if (url.pathname !== '/' || /[?#]/.test(value)) return HOSTING_MESSAGES.path
  return undefined
}

/** Spec message for a non-empty invalid value; `undefined` when empty or valid. */
export function hostingFieldError(
  field: HostingField,
  raw: string,
): string | undefined {
  const value = raw.trim()
  if (value === '') return undefined
  switch (field) {
    case 'accountId': {
      if (HEX32.test(value)) return undefined
      const endpoint = parseEndpoint(value)
      if (endpoint.kind === 'jurisdiction') return HOSTING_MESSAGES.jurisdiction
      return endpoint.kind === 'endpoint'
        ? undefined
        : HOSTING_MESSAGES.accountId
    }
    case 'bucket':
      return BUCKET_PATTERN.test(value) ? undefined : HOSTING_MESSAGES.bucket
    case 'accessKeyId':
      return HEX32.test(value) ? undefined : HOSTING_MESSAGES.accessKeyId
    case 'secretAccessKey':
      return HEX64.test(value) ? undefined : HOSTING_MESSAGES.secretAccessKey
    case 'publicBaseUrl':
      return siteAddressError(value)
  }
}

export type HostingFormValidation =
  | { ok: true; value: R2Credentials }
  | { ok: false; errors: Partial<Record<HostingField, string>> }

/**
 * All five fields valid → normalised credentials (lowercase account id, site
 * address `https://<host>`); else the message per field (`Required` when
 * empty). Connect stays disabled until `ok`.
 */
export function validateHostingForm(
  input: HostingInput,
): HostingFormValidation {
  // Account ID last: an endpoint URL's bucket fills only a still-empty Bucket.
  const normalised = setHostingField(
    HOSTING_FIELDS.filter((field) => field !== 'accountId').reduce(
      (result, field) => setHostingField(result, field, input[field]),
      input,
    ),
    'accountId',
    input.accountId,
  )
  const errors: Partial<Record<HostingField, string>> = {}
  for (const field of HOSTING_FIELDS) {
    const error =
      normalised[field] === ''
        ? 'Required'
        : hostingFieldError(field, normalised[field])
    if (error !== undefined) errors[field] = error
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      ...normalised,
      publicBaseUrl: normaliseSiteAddress(normalised.publicBaseUrl),
    },
  }
}

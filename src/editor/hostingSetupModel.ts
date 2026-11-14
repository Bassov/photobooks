import {
  bucketNameFor,
  type Discovery,
  type RowState,
  type SetupRow,
} from '../publish/provision'

/* Settings → Hosting guided setup (Designer Spec connect-own-hosting C1–C10, kit demo-parts/hostingSetup.tsx): the
   pure rules of the three-step card. The setup token itself never passes through here. */

export const SETUP_MESSAGES = {
  token: "This doesn't look like a Cloudflare API token.",
  subdomain: 'Use a–z, 0–9 and hyphens, like books.',
}

const SETUP_TOKEN = /^[A-Za-z0-9_-]{40,200}$/
const SUBDOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** `''` while empty, else whether the trimmed value looks like a Cloudflare API token. */
export function setupTokenState(raw: string): '' | 'ok' | 'bad' {
  const token = raw.trim()
  if (token === '') return ''
  return SETUP_TOKEN.test(token) ? 'ok' : 'bad'
}

/** The typed subdomain as used: trimmed and lowercased. */
export function tidySubdomain(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Empty is fine (the zone apex); otherwise a DNS label. */
export function subdomainError(sub: string): string | undefined {
  return sub === '' || SUBDOMAIN.test(sub)
    ? undefined
    : SETUP_MESSAGES.subdomain
}

/** `books` + `basov.photo` → `books.basov.photo`; an empty subdomain is the apex. */
export function siteHost(sub: string, zone: string): string {
  return sub === '' ? zone : `${sub}.${zone}`
}

type Zone = Discovery['zonesByAccount'][string][number]

export interface AddressView {
  /** Active zones of the account, in Cloudflare's order. */
  active: Zone[]
  /** Names of zones waiting for nameservers. */
  pending: string[]
}

/** Step 2's zones for one account. */
export function addressView(
  discovery: Discovery,
  accountId: string,
): AddressView {
  const zones = discovery.zonesByAccount[accountId] ?? []
  return {
    active: zones.filter((zone) => zone.status === 'active'),
    pending: zones
      .filter((zone) => zone.status === 'pending')
      .map((zone) => zone.name),
  }
}

export interface SetupTarget {
  host: string
  bucket: string
  /** The account already has the bucket: setup reuses it (C7). */
  reused: boolean
}

export function setupTarget(
  discovery: Discovery,
  accountId: string,
  sub: string,
  zone: string,
): SetupTarget {
  const host = siteHost(sub, zone)
  const bucket = bucketNameFor(host)
  return {
    host,
    bucket,
    reused: discovery.bucketsByAccount[accountId]?.includes(bucket) === true,
  }
}

export function setupRowTexts(bucket: string, host: string): string[] {
  return [
    `Create the bucket ${bucket}`,
    'Allow uploads from Photobooks',
    `Connect ${host}`,
    'Create a key for this bucket only',
    'Test an upload',
    'Delete the setup token',
  ]
}

export type RowView = 'pending' | 'running' | 'done' | 'failed' | 'warn'

export interface ProgressView {
  rows: readonly RowView[]
  /** The failed row's message. */
  message?: string
}

export const PENDING_PROGRESS: ProgressView = {
  rows: ['pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
}

const VIEW: Record<RowState['state'], RowView> = {
  running: 'running',
  done: 'done',
  warning: 'warn',
  failed: 'failed',
}

/**
 * One `runSetup` state onto the six rows: a running row resets the rows after it (a resume from 5 without keys
 * runs 4 again), earlier rows keep their state (C8).
 */
export function applyRowState(
  view: ProgressView,
  state: RowState,
): ProgressView {
  const index = state.row - 1
  const rows = view.rows.map((row, i): RowView => {
    if (i === index) return VIEW[state.state]
    return state.state === 'running' && i > index ? 'pending' : row
  })
  return state.state === 'failed' ? { rows, message: state.message } : { rows }
}

/** Try again's `from`: the failed row. */
export function failedRow(view: ProgressView): SetupRow | undefined {
  const index = view.rows.indexOf('failed')
  return index === -1 ? undefined : ((index + 1) as SetupRow)
}

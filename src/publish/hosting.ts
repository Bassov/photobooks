/**
 * Settings → Hosting "Connect" / "Check again" over the stored credentials;
 * the check itself is the target's (`Publisher.check`).
 */

import {
  createCredentialStore,
  type HostingStatus,
  type R2Credentials,
} from './credentials'
import {
  createPublisher,
  type CheckResult,
  type PublishDeps,
} from './publisher'

export type { CheckResult } from './publisher'

export interface HostingDeps extends PublishDeps {
  indexedDB?: IDBFactory
}

function clock(deps: HostingDeps): () => Date {
  return deps.now ?? (() => new Date())
}

/** Connect: check first; save the credentials and an `ok` status only on a pass. */
export async function connectHosting(
  credentials: R2Credentials,
  deps: HostingDeps = {},
): Promise<CheckResult> {
  const result = await createPublisher(credentials, deps).check('connect')
  if (!result.ok) return result
  const store = createCredentialStore(deps.indexedDB)
  await store.save(credentials)
  await store.saveStatus({
    checkedAtMs: clock(deps)().getTime(),
    ok: true,
  })
  return result
}

/**
 * Check again: re-checks the stored credentials and stores the result.
 * `null` when nothing is stored.
 */
export async function recheckHosting(
  deps: HostingDeps = {},
): Promise<HostingStatus | null> {
  const store = createCredentialStore(deps.indexedDB)
  const credentials = await store.load()
  if (credentials === undefined) return null
  const result = await createPublisher(credentials, deps).check('recheck')
  const checkedAtMs = clock(deps)().getTime()
  const status: HostingStatus = result.ok
    ? { checkedAtMs, ok: true }
    : { checkedAtMs, ok: false, code: result.code, message: result.message }
  await store.saveStatus(status)
  return status
}

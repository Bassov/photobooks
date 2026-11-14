/** The Cloudflare R2 publish target: S3 SigV4 requests against one bucket. */

import { checkConnection } from './checkConnection'
import type { R2Credentials } from './credentials'
import type { PublishDeps, Publisher } from './publisher'
import { publishSite, R2_CAPABILITIES } from './publishSite'

export function createR2Publisher(
  credentials: R2Credentials,
  deps: PublishDeps = {},
): Publisher {
  return {
    target: 'r2',
    capabilities: R2_CAPABILITIES,
    publish: (input) => publishSite({ ...input, credentials }, deps),
    check: (mode) => checkConnection(credentials, mode, deps),
  }
}

/**
 * Publish targets: every publish and hosting check goes through a `Publisher`.
 * A target says what it can do in `capabilities`; Cloudflare R2
 * (`r2Publisher.ts`) is the one target today.
 */

import type { CheckCode, R2Credentials } from './credentials'
import { createR2Publisher } from './r2Publisher'
import type { PublishFile } from './uploadPlan'

type PublisherTarget = 'r2'

export interface PublisherCapabilities {
  /** Content-hashed assets go out with an immutable `Cache-Control`. */
  immutableCache: boolean
  /** Uploads in flight at once, at most. */
  maxParallelUploads: number
  /** Files the last publish had and this one lacks are removed. */
  deletes: boolean
}

export interface PublishSiteFile extends PublishFile {
  bytes: Uint8Array
}

export interface PublishProgress {
  /** `upload`: bytes put; `finish`: deletes and the manifest, by request. */
  phase: 'upload' | 'finish'
  done: number
  total: number
}

export interface PublishInput {
  files: readonly PublishSiteFile[]
  /** Site-root-relative page to link; `''` is the site home. */
  bookPath: string
  onProgress?: (progress: PublishProgress) => void
}

export type PublishResult =
  | {
      ok: true
      uploaded: number
      bytes: number
      removed: number
      unchanged: number
      bookUrl: string
    }
  | {
      ok: false
      code: CheckCode
      status?: number
      /** Redacted. */
      message: string
      /** Files put before the run stopped, of `total` to put. */
      sent: number
      total: number
    }

export type CheckMode = 'connect' | 'recheck'

export type CheckResult =
  | { ok: true }
  | {
      ok: false
      code: CheckCode
      /** Footer message, redacted. */
      message: string
      /** Fields to ring red. */
      fields: readonly (keyof R2Credentials)[]
    }

export interface PublishDeps {
  fetch?: typeof fetch
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  /** `navigator.onLine` by default. */
  isOnline?: () => boolean
  /** Check object name suffix; 4 random bytes by default. */
  randomHex?: () => string
}

export interface Publisher {
  readonly target: PublisherTarget
  readonly capabilities: PublisherCapabilities
  /** Uploads the site against the target's last publish; never throws. */
  publish(input: PublishInput): Promise<PublishResult>
  /** A real write, read and delete on the target. */
  check(mode: CheckMode): Promise<CheckResult>
}

/** The publisher for stored hosting credentials. */
export function createPublisher(
  credentials: R2Credentials,
  deps: PublishDeps = {},
): Publisher {
  return createR2Publisher(credentials, deps)
}

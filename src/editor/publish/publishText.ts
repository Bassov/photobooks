import type { PublishFailureCode } from '../../publish/publish.worker'

/** Designer spec in-app-publish §1–§2: every Publish string. */

/** `prepare`: web derivatives on the page side; the rest are worker phases. */
export type PublishPhase = 'prepare' | 'render' | 'upload' | 'finish'

export interface PublishSummary {
  uploaded: number
  bytes: number
  removed: number
  unchanged: number
}

/** §2 failed codes (`build`: the site could not be prepared). */
export type PublishFailCode = Exclude<PublishFailureCode, 'render'> | 'build'

export interface PublishFailure {
  code: PublishFailCode
  status?: number
  /** Redacted worker message (carries the S3 answer for `other`). */
  message: string
  sent: number
  total: number
}

/** Overall percent bands per phase; §2 labels split at 50 and 95. */
const PHASE_BANDS: Record<PublishPhase, readonly [number, number]> = {
  prepare: [0, 40],
  render: [40, 50],
  upload: [50, 95],
  finish: [95, 100],
}

export const PUBLISH_NAME = 'Publish'
export const PUBLISH_DONE_STATUS = 'Published'
export const PUBLISH_FAILED_STATUS = "Publish didn't finish"
export const PUBLISH_WAIT_TITLE = 'Wait until Publish finishes'
export const EXPORT_WAIT_TITLE = 'Wait until the export finishes'

/** One 0–100 integer across the phases; `total` 0 counts as done. */
export function publishPercent(
  phase: PublishPhase,
  done: number,
  total: number,
): number {
  const [from, to] = PHASE_BANDS[phase]
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1
  return Math.floor(from + (to - from) * share)
}

export function publishPhaseLabel(percent: number): string {
  if (percent < 50) return 'Rendering web images'
  if (percent < 95) return 'Uploading changed files'
  return 'Finishing'
}

export function publishRunningTitle(percent: number): string {
  return `Publishing · ${String(percent)}%`
}

export function publishStatusText(percent: number): string {
  return `Publishing, ${String(percent)}%`
}

/** "“Lake” goes to books.example.com with the other published books." */
export function publishHostLine(
  title: string,
  host: string,
  hasOthers: boolean,
): { before: string; host: string; after: string } {
  return {
    before: `“${title}” goes to `,
    host,
    after: hasOthers ? ' with the other published books.' : '.',
  }
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

/** "14 changed files uploaded · 3.2 MB, 2 removed. 186 were already up to date." */
export function publishSummaryText(summary: PublishSummary): string {
  if (summary.uploaded === 0) {
    return 'Nothing changed since the last publish.'
  }
  const removed =
    summary.removed > 0 ? `, ${String(summary.removed)} removed` : ''
  const uploaded = plural(summary.uploaded, 'changed file', 'changed files')
  const unchanged = plural(
    summary.unchanged,
    'was already up to date',
    'were already up to date',
  )
  return `${uploaded} uploaded · ${(summary.bytes / 1e6).toFixed(1)} MB${removed}. ${unchanged}.`
}

const RETRYABLE: ReadonlySet<PublishFailCode> = new Set([
  'offline',
  'timeout',
  'other',
  'build',
])

/** `retry` re-runs the same freeze; `hosting` opens Settings → Hosting. */
export function publishFailAction(code: PublishFailCode): 'retry' | 'hosting' {
  return RETRYABLE.has(code) ? 'retry' : 'hosting'
}

/** "503 SlowDown" out of the worker's "Cloudflare answered 503 SlowDown. …". */
function answerOf(failure: PublishFailure): string {
  const answered = /^Cloudflare answered (.+?)\. /.exec(failure.message)?.[1]
  return (
    answered ?? (failure.status === undefined ? '' : String(failure.status))
  )
}

function causeText(failure: PublishFailure, bucket: string): string {
  switch (failure.code) {
    case 'offline':
      return "You're offline. Connect to the internet and try again."
    case 'timeout':
      return "Cloudflare didn't answer in 30 seconds."
    case 'other': {
      const answer = answerOf(failure)
      return answer === ''
        ? 'Something went wrong. Try again.'
        : `Cloudflare answered ${answer}.`
    }
    case 'cors':
      return 'Cloudflare blocked the upload from this page. Check the CORS policy in Settings → Hosting.'
    case 'key':
      return "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting."
    case 'denied':
      return `This token can't write to “${bucket}”. Give it Object Read & Write on this bucket.`
    case 'bucket':
      return `There's no bucket “${bucket}” in this account.`
    case 'unconnected':
      return 'Connect your hosting in Settings → Hosting first.'
    case 'build':
      return 'Something went wrong while preparing the site. Try again.'
  }
}

/** §2 failed text: the cause, then "s of t files went up" when a retry sends the rest. */
export function publishFailText(
  failure: PublishFailure,
  bucket: string,
): string {
  const cause = causeText(failure, bucket)
  if (failure.sent > 0 && publishFailAction(failure.code) === 'retry') {
    return `${cause} ${String(failure.sent)} of ${String(failure.total)} files went up. Try again to send the rest.`
  }
  return cause
}

/** Cross-pool coordination so hash stays behind metadata (background > hash). */

let pendingMetadataJobs = 0
let onIdle: (() => void) | undefined
const idleWaiters: (() => void)[] = []

export function setPoolIdleNudge(nudge: (() => void) | undefined): void {
  onIdle = nudge
}

export function beginMetadataJob(): void {
  pendingMetadataJobs += 1
}

export function endMetadataJob(): void {
  pendingMetadataJobs = Math.max(0, pendingMetadataJobs - 1)
  if (pendingMetadataJobs === 0) {
    onIdle?.()
    const waiters = idleWaiters.splice(0, idleWaiters.length)
    for (const waiter of waiters) {
      waiter()
    }
  }
}

export function hasPendingMetadataJobs(): boolean {
  return pendingMetadataJobs > 0
}

/** Resolve when no metadata jobs are in flight (hashContent waits here). */
export function whenMetadataIdle(): Promise<void> {
  if (pendingMetadataJobs === 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    idleWaiters.push(resolve)
  })
}

/** Test helper */
export function resetPoolCoordination(): void {
  pendingMetadataJobs = 0
  onIdle = undefined
  idleWaiters.length = 0
}

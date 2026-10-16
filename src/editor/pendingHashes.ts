const pending = new Set<Promise<unknown>>()

/** Track an in-flight content-hash job so Save can await settle. */
export function trackHashJob<T>(job: Promise<T>): Promise<T> {
  const tracked = job.finally(() => {
    pending.delete(tracked)
  })
  pending.add(tracked)
  return tracked
}

/** Wait until every tracked hash job has settled (success or failure). */
export async function awaitPendingHashes(): Promise<void> {
  while (pending.size > 0) {
    await Promise.all([...pending])
  }
}

export function resetPendingHashesForTests(): void {
  pending.clear()
}

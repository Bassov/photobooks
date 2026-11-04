/**
 * Asset ids of tracked decode jobs, kept as jobs enter and leave the queue /
 * in-flight set so a lookup never scans them. A job counts once: a second
 * add or delete of the same job is a no-op.
 */
export class PendingJobIndex<Job extends { readonly assetId: string }> {
  private readonly jobs = new Set<Job>()
  private readonly countByAsset = new Map<string, number>()

  add(job: Job): void {
    if (this.jobs.has(job)) {
      return
    }
    this.jobs.add(job)
    this.countByAsset.set(
      job.assetId,
      (this.countByAsset.get(job.assetId) ?? 0) + 1,
    )
  }

  delete(job: Job): void {
    if (!this.jobs.delete(job)) {
      return
    }
    const left = (this.countByAsset.get(job.assetId) ?? 1) - 1
    if (left > 0) {
      this.countByAsset.set(job.assetId, left)
    } else {
      this.countByAsset.delete(job.assetId)
    }
  }

  has(assetId: string): boolean {
    return this.countByAsset.has(assetId)
  }

  clear(): void {
    this.jobs.clear()
    this.countByAsset.clear()
  }
}

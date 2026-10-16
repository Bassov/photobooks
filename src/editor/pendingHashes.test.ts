import { afterEach, describe, expect, it } from 'vitest'
import {
  awaitPendingHashes,
  resetPendingHashesForTests,
  trackHashJob,
} from './pendingHashes'

describe('pendingHashes', () => {
  afterEach(() => {
    resetPendingHashesForTests()
  })

  it('awaitPendingHashes resolves when no jobs are tracked', async () => {
    await expect(awaitPendingHashes()).resolves.toBeUndefined()
  })

  it('awaitPendingHashes waits for tracked jobs to settle', async () => {
    let resolveJob!: (value: string) => void
    const job = new Promise<string>((resolve) => {
      resolveJob = resolve
    })
    const tracked = trackHashJob(job)
    let settled = false
    const waiting = awaitPendingHashes().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    resolveJob('done')
    await expect(tracked).resolves.toBe('done')
    await waiting
    expect(settled).toBe(true)
  })

  it('awaitPendingHashes continues after a rejected job', async () => {
    const tracked = trackHashJob(Promise.reject(new Error('hash failed')))
    await expect(tracked).rejects.toThrow('hash failed')
    await expect(awaitPendingHashes()).resolves.toBeUndefined()
  })

  it('resetPendingHashesForTests clears the queue', async () => {
    let resolveJob!: (value: number) => void
    void trackHashJob(
      new Promise<number>((resolve) => {
        resolveJob = resolve
      }),
    )
    resetPendingHashesForTests()
    await expect(awaitPendingHashes()).resolves.toBeUndefined()
    resolveJob(1)
  })
})

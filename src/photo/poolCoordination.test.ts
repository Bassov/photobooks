import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  beginMetadataJob,
  endMetadataJob,
  hasPendingMetadataJobs,
  resetPoolCoordination,
  setPoolIdleNudge,
  whenMetadataIdle,
} from './poolCoordination'

describe('poolCoordination', () => {
  afterEach(() => {
    resetPoolCoordination()
  })

  it('tracks pending metadata jobs and nudges on idle', () => {
    const nudge = vi.fn()
    setPoolIdleNudge(nudge)
    expect(hasPendingMetadataJobs()).toBe(false)

    beginMetadataJob()
    beginMetadataJob()
    expect(hasPendingMetadataJobs()).toBe(true)
    expect(nudge).not.toHaveBeenCalled()

    endMetadataJob()
    expect(hasPendingMetadataJobs()).toBe(true)
    expect(nudge).not.toHaveBeenCalled()

    endMetadataJob()
    expect(hasPendingMetadataJobs()).toBe(false)
    expect(nudge).toHaveBeenCalledTimes(1)
  })

  it('does not go negative when ending without begin', () => {
    endMetadataJob()
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('whenMetadataIdle resolves immediately when already idle', async () => {
    await expect(whenMetadataIdle()).resolves.toBeUndefined()
  })

  it('whenMetadataIdle waits until pending jobs drain', async () => {
    beginMetadataJob()
    let resolved = false
    const idle = whenMetadataIdle().then(() => {
      resolved = true
    })
    expect(resolved).toBe(false)
    endMetadataJob()
    await idle
    expect(resolved).toBe(true)
  })

  it('reset clears nudge and pending waiters without invoking them', async () => {
    const nudge = vi.fn()
    setPoolIdleNudge(nudge)
    beginMetadataJob()
    const idle = whenMetadataIdle()
    resetPoolCoordination()
    expect(hasPendingMetadataJobs()).toBe(false)
    setPoolIdleNudge(undefined)
    beginMetadataJob()
    endMetadataJob()
    expect(nudge).not.toHaveBeenCalled()
    // Previous waiter must not hang forever after reset cleared the queue.
    await Promise.race([
      idle.then(() => {
        throw new Error('stale waiter should not resolve after reset')
      }),
      Promise.resolve(),
    ])
  })

  it('clears nudge when set to undefined', () => {
    const nudge = vi.fn()
    setPoolIdleNudge(nudge)
    setPoolIdleNudge(undefined)
    beginMetadataJob()
    endMetadataJob()
    expect(nudge).not.toHaveBeenCalled()
  })
})

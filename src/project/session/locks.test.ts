import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookLockName, createNavigatorSessionLocks } from './locks'
import {
  createMemoryLockManager,
  installMemoryLockManager,
} from './locks.test-helpers'

beforeEach(() => {
  installMemoryLockManager(createMemoryLockManager())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bookLockName', () => {
  it('returns the photobooks:book:<id> name used across tabs', () => {
    expect(bookLockName('spread-9')).toBe('photobooks:book:spread-9')
    expect(bookLockName('a')).toBe('photobooks:book:a')
  })
})

describe('createNavigatorSessionLocks', () => {
  it('grants the lock when available and releases after the callback', async () => {
    const locks = createNavigatorSessionLocks()
    const seen: (string | null)[] = []

    await locks.request('photobooks:book:1', { ifAvailable: true }, (lock) => {
      seen.push(lock?.name ?? null)
    })

    expect(seen).toEqual(['photobooks:book:1'])
  })

  it('passes null when ifAvailable and another holder keeps the same name', async () => {
    const shared = createMemoryLockManager()
    installMemoryLockManager(shared)

    const tabA = createNavigatorSessionLocks()
    const tabB = createNavigatorSessionLocks()

    let releaseA!: () => void
    const heldByA = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    let signalAcquired!: () => void
    const acquired = new Promise<void>((resolve) => {
      signalAcquired = resolve
    })

    const aStarted = tabA.request(
      bookLockName('book-1'),
      { ifAvailable: true },
      async (lock) => {
        expect(lock).not.toBeNull()
        signalAcquired()
        await heldByA
      },
    )

    await acquired

    const bResults: (Lock | null)[] = []
    await tabB.request(
      bookLockName('book-1'),
      { ifAvailable: true },
      (lock) => {
        bResults.push(lock)
      },
    )

    expect(bResults).toEqual([null])

    releaseA()
    await aStarted
  })

  it('allows a second tab to acquire after the first releases', async () => {
    const shared = createMemoryLockManager()
    installMemoryLockManager(shared)
    const tabA = createNavigatorSessionLocks()
    const tabB = createNavigatorSessionLocks()
    const name = bookLockName('shared-book')

    await tabA.request(name, { ifAvailable: true }, (lock) => {
      expect(lock).not.toBeNull()
    })

    const second: (Lock | null)[] = []
    await tabB.request(name, { ifAvailable: true }, (lock) => {
      second.push(lock)
    })
    expect(second[0]?.name).toBe(name)
  })

  it('contends on bookLockName across two navigator adapters (cross-tab)', async () => {
    const shared = createMemoryLockManager()
    installMemoryLockManager(shared)
    const left = createNavigatorSessionLocks()
    const right = createNavigatorSessionLocks()
    const name = bookLockName('cross-tab')

    let releaseLeft!: () => void
    const leftHeld = new Promise<void>((resolve) => {
      releaseLeft = resolve
    })
    let signalAcquired!: () => void
    const acquired = new Promise<void>((resolve) => {
      signalAcquired = resolve
    })

    const leftDone = left.request(name, { ifAvailable: true }, async (lock) => {
      expect(lock?.name).toBe(name)
      signalAcquired()
      await leftHeld
    })

    await acquired

    let rightSaw: Lock | null | undefined
    await right.request(name, { ifAvailable: true }, (lock) => {
      rightSaw = lock
    })
    expect(rightSaw).toBeNull()

    releaseLeft()
    await leftDone

    await right.request(name, { ifAvailable: true }, (lock) => {
      rightSaw = lock
    })
    expect(rightSaw?.name).toBe(name)
  })
})

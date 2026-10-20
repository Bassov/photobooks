import type { LockRequestCallback } from './locks'

/**
 * In-memory LockManager for Vitest. When `ifAvailable` is set and the named
 * lock is already held, the callback receives `null` (Web Locks contract).
 */
export function createMemoryLockManager(): LockManager {
  const held = new Set<string>()

  const manager: LockManager = {
    request(
      name: string,
      optionsOrCallback:
        LockOptions | ((lock: Lock | null) => void | Promise<void>),
      maybeCallback?: (lock: Lock | null) => void | Promise<void>,
    ): Promise<Lock | null> {
      const options: LockOptions =
        typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
      const callback: LockRequestCallback =
        typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : (maybeCallback ?? (() => undefined))

      return (async () => {
        if (options.ifAvailable === true && held.has(name)) {
          await callback(null)
          return null
        }
        held.add(name)
        const lock: Lock = { name, mode: 'exclusive' }
        try {
          await callback(lock)
          return lock
        } finally {
          held.delete(name)
        }
      })()
    },
    query() {
      return Promise.resolve({ held: [], pending: [] })
    },
  }
  return manager
}

export function installMemoryLockManager(
  manager: LockManager = createMemoryLockManager(),
): LockManager {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: manager,
  })
  return manager
}

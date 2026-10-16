export type LockRequestCallback = (lock: Lock | null) => void | Promise<void>

export interface SessionLocks {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: LockRequestCallback,
  ) => Promise<void>
}

export function createNavigatorSessionLocks(): SessionLocks {
  return {
    request(name, options, callback) {
      return navigator.locks
        .request(name, options, callback)
        .then(() => undefined)
    },
  }
}

export function bookLockName(bookId: string): string {
  return `photobooks:book:${bookId}`
}

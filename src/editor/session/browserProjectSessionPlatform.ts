import {
  createBrowserSessionState,
  createFsaLibraryStorage,
  createMemorySessionState,
  type LibraryStorage,
  type SessionDirectoryHandle,
  type SessionState,
} from '../../project'

export interface ProjectSessionTimers {
  setTimeout: typeof globalThis.setTimeout
  clearTimeout: typeof globalThis.clearTimeout
}

export type RequestReadwritePermission = (
  handle: SessionDirectoryHandle,
) => Promise<'granted' | 'denied' | 'unavailable'>

export const browserTimers: ProjectSessionTimers = {
  // Look up globals at call time so Vitest fake timers still apply.
  setTimeout: ((handler: () => void, timeout?: number) =>
    globalThis.setTimeout(handler, timeout)) as typeof globalThis.setTimeout,
  clearTimeout: ((id: ReturnType<typeof globalThis.setTimeout>) => {
    globalThis.clearTimeout(id)
  }) as typeof globalThis.clearTimeout,
}

/** Delegates FS vs library-protocol roots to `createFsaLibraryStorage`. */
export function defaultStorageFromHandle(
  root: SessionDirectoryHandle,
): LibraryStorage {
  return createFsaLibraryStorage({
    root: root as Parameters<typeof createFsaLibraryStorage>[0]['root'],
  })
}

export function createDefaultSession(): SessionState {
  if (typeof indexedDB === 'undefined') {
    return createMemorySessionState()
  }
  return createBrowserSessionState()
}

/** Browser `showDirectoryPicker`; AbortError → null. */
export async function browserPickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (
    globalThis as typeof globalThis & {
      showDirectoryPicker?: (options?: {
        mode?: 'read' | 'readwrite'
      }) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker
  if (typeof picker !== 'function') {
    return null
  }
  try {
    return await picker({ mode: 'readwrite' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export async function browserRequestReadwritePermission(
  handle: SessionDirectoryHandle,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const candidate = handle as {
    requestPermission?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<PermissionState>
  }
  const requestPermission = candidate.requestPermission
  if (typeof requestPermission !== 'function') {
    return 'unavailable'
  }
  try {
    const state = await requestPermission.call(handle, { mode: 'readwrite' })
    return state === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

/** Browser defaults for `configureProjectSession` at the composition root. */
export function createBrowserProjectSessionDeps(): {
  session: SessionState
  createStorage: (root: SessionDirectoryHandle) => LibraryStorage
  pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
  requestReadwritePermission: RequestReadwritePermission
  timers: ProjectSessionTimers
  storageKey?: Storage
} {
  const deps: {
    session: SessionState
    createStorage: (root: SessionDirectoryHandle) => LibraryStorage
    pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
    requestReadwritePermission: RequestReadwritePermission
    timers: ProjectSessionTimers
    storageKey?: Storage
  } = {
    session: createDefaultSession(),
    createStorage: defaultStorageFromHandle,
    pickDirectory: browserPickDirectory,
    requestReadwritePermission: browserRequestReadwritePermission,
    timers: browserTimers,
  }
  const key = Reflect.get(globalThis, 'sessionStorage') as Storage | undefined
  if (key !== undefined) {
    deps.storageKey = key
  }
  return deps
}

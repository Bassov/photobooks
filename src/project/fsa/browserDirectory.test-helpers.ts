interface FakeDir {
  files: Map<string, string>
  dirs: Map<string, FakeDir>
}

function createFakeDir(): FakeDir {
  return { files: new Map(), dirs: new Map() }
}

export interface FakeBrowserDirectoryHandle extends FileSystemDirectoryHandle {
  setPermission: (state: PermissionState) => void
  enqueueQueryResults: (...states: PermissionState[]) => void
  enqueueRequestResults: (...states: PermissionState[]) => void
  queryPermission: (
    descriptor?: FileSystemHandlePermissionDescriptor,
  ) => Promise<PermissionState>
  requestPermission: (
    descriptor?: FileSystemHandlePermissionDescriptor,
  ) => Promise<PermissionState>
}

export type FakeDirectoryPickerOutcome =
  FakeBrowserDirectoryHandle | FileSystemDirectoryHandle | 'abort'

interface PermissionController {
  sticky: PermissionState
  queryQueue: PermissionState[]
  requestQueue: PermissionState[]
}

function createPermissionController(
  initial: PermissionState,
): PermissionController {
  return {
    sticky: initial,
    queryQueue: [],
    requestQueue: [],
  }
}

function nextPermission(
  controller: PermissionController,
  kind: 'query' | 'request',
): PermissionState {
  const queue =
    kind === 'query' ? controller.queryQueue : controller.requestQueue
  const next = queue.shift()
  if (next !== undefined) {
    if (kind === 'request' && next === 'granted') {
      controller.sticky = 'granted'
    }
    return next
  }
  return controller.sticky
}

function toHandle(
  node: FakeDir,
  name: string,
  permission: PermissionController,
): FakeBrowserDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    setPermission(state: PermissionState) {
      permission.sticky = state
    },
    enqueueQueryResults(...states: PermissionState[]) {
      permission.queryQueue.push(...states)
    },
    enqueueRequestResults(...states: PermissionState[]) {
      permission.requestQueue.push(...states)
    },
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor) {
      if (descriptor?.mode !== undefined && descriptor.mode !== 'readwrite') {
        return Promise.resolve('prompt' as PermissionState)
      }
      return Promise.resolve(nextPermission(permission, 'query'))
    },
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor) {
      if (descriptor?.mode !== undefined && descriptor.mode !== 'readwrite') {
        return Promise.resolve('prompt' as PermissionState)
      }
      return Promise.resolve(nextPermission(permission, 'request'))
    },
    getDirectoryHandle(
      child: string,
      options?: { create?: boolean },
    ): Promise<FakeBrowserDirectoryHandle> {
      const existing = node.dirs.get(child)
      if (existing) {
        return Promise.resolve(
          toHandle(existing, child, createPermissionController('granted')),
        )
      }
      if (options?.create !== true) {
        return Promise.reject(
          new DOMException(`"${child}" not found`, 'NotFoundError'),
        )
      }
      const created = createFakeDir()
      node.dirs.set(child, created)
      return Promise.resolve(
        toHandle(created, child, createPermissionController('granted')),
      )
    },
    getFileHandle(child: string, options?: { create?: boolean }) {
      if (!node.files.has(child) && options?.create !== true) {
        return Promise.reject(
          new DOMException(`"${child}" not found`, 'NotFoundError'),
        )
      }
      if (!node.files.has(child)) {
        node.files.set(child, '')
      }
      return Promise.resolve({
        kind: 'file' as const,
        name: child,
        getFile() {
          return Promise.resolve(new File([node.files.get(child) ?? ''], child))
        },
        createWritable() {
          let content = ''
          return Promise.resolve({
            write(chunk: string) {
              content += chunk
              return Promise.resolve()
            },
            close() {
              node.files.set(child, content)
              return Promise.resolve()
            },
          })
        },
      })
    },
    removeEntry(child: string) {
      node.files.delete(child)
      node.dirs.delete(child)
      return Promise.resolve()
    },
    async *values() {
      for (const fileName of node.files.keys()) {
        yield await Promise.resolve({ kind: 'file' as const, name: fileName })
      }
      for (const dirName of node.dirs.keys()) {
        yield await Promise.resolve({
          kind: 'directory' as const,
          name: dirName,
        })
      }
    },
  }
  return handle as unknown as FakeBrowserDirectoryHandle
}

export interface CreateFakeBrowserDirectoryOptions {
  name?: string
  initialPermission?: PermissionState
}

/** In-memory browser-shaped `FileSystemDirectoryHandle` for adapter tests. */
export function createFakeBrowserDirectory(
  options?: CreateFakeBrowserDirectoryOptions,
): FakeBrowserDirectoryHandle {
  return toHandle(
    createFakeDir(),
    options?.name ?? 'library',
    createPermissionController(options?.initialPermission ?? 'granted'),
  )
}

/**
 * Scriptable stand-in for `window.showDirectoryPicker`.
 * Outcomes are consumed in order; `'abort'` rejects with `AbortError`.
 */
export function createFakeDirectoryPicker(options: {
  outcomes: FakeDirectoryPickerOutcome[]
}): () => Promise<FileSystemDirectoryHandle> {
  const remaining = [...options.outcomes]
  return () => {
    const next = remaining.shift()
    if (next === undefined) {
      return Promise.reject(
        new Error('createFakeDirectoryPicker: no outcomes left'),
      )
    }
    if (next === 'abort') {
      return Promise.reject(new DOMException('User cancelled', 'AbortError'))
    }
    return Promise.resolve(next)
  }
}

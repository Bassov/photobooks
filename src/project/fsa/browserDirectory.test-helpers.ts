type FakeFileContent = string | Uint8Array | ArrayBuffer

interface FakeDir {
  files: Map<string, FakeFileContent>
  dirs: Map<string, FakeDir>
  /** Bumped on every replace/remove; stale `File` snapshots stop reading. */
  versions: Map<string, number>
  snapshotHooks: Map<string, () => void>
}

function createFakeDir(): FakeDir {
  return {
    files: new Map(),
    dirs: new Map(),
    versions: new Map(),
    snapshotHooks: new Map(),
  }
}

function replaceFile(
  node: FakeDir,
  name: string,
  content: FakeFileContent | undefined,
): void {
  if (content === undefined) {
    node.files.delete(name)
  } else {
    node.files.set(name, content)
  }
  node.versions.set(name, (node.versions.get(name) ?? 0) + 1)
}

/**
 * Chromium rule: a `File` from `getFile()` is a snapshot; once the file is
 * replaced (a writable closes over it) reading the snapshot rejects
 * `NotReadableError`.
 */
function snapshotFile(node: FakeDir, name: string): File {
  const version = node.versions.get(name) ?? 0
  const file = fileFromContent(name, node.files.get(name) ?? '')
  const guard =
    <T>(read: () => Promise<T>) =>
    (): Promise<T> =>
      (node.versions.get(name) ?? 0) === version
        ? read()
        : Promise.reject(
            new DOMException(
              'The requested file could not be read',
              'NotReadableError',
            ),
          )
  Object.assign(file, {
    text: guard(() => Blob.prototype.text.call(file)),
    arrayBuffer: guard(() => Blob.prototype.arrayBuffer.call(file)),
  })
  node.snapshotHooks.get(name)?.()
  return file
}

export interface FakeBrowserDirectoryHandle extends FileSystemDirectoryHandle {
  /** Writes or replaces a file entry (string or binary). */
  writeFile: (name: string, content: FakeFileContent) => void
  /** Runs `hook` right after every `getFile()` snapshot of `name`. */
  onSnapshot: (name: string, hook: (() => void) | undefined) => void
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

function fileFromContent(name: string, content: FakeFileContent): File {
  const lastModified = Date.now()
  if (typeof content === 'string') {
    return new File([content], name, { lastModified })
  }
  if (content instanceof ArrayBuffer) {
    return new File([content], name, { lastModified })
  }
  const copy = new Uint8Array(content.byteLength)
  copy.set(content)
  return new File([copy], name, { lastModified })
}

function toHandle(
  node: FakeDir,
  name: string,
  permission: PermissionController,
): FakeBrowserDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    writeFile(child: string, content: FakeFileContent) {
      replaceFile(node, child, content)
    },
    onSnapshot(child: string, hook: (() => void) | undefined) {
      if (hook === undefined) {
        node.snapshotHooks.delete(child)
      } else {
        node.snapshotHooks.set(child, hook)
      }
    },
    setPermission(state: PermissionState) {
      permission.sticky = state
    },
    enqueueQueryResults(...states: PermissionState[]) {
      permission.queryQueue.push(...states)
    },
    enqueueRequestResults(...states: PermissionState[]) {
      permission.requestQueue.push(...states)
    },
    queryPermission() {
      return Promise.resolve(nextPermission(permission, 'query'))
    },
    requestPermission() {
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
          return Promise.resolve(snapshotFile(node, child))
        },
        createWritable() {
          let content = ''
          return Promise.resolve({
            write(chunk: string) {
              content += chunk
              return Promise.resolve()
            },
            close() {
              replaceFile(node, child, content)
              return Promise.resolve()
            },
          })
        },
      })
    },
    removeEntry(child: string) {
      replaceFile(node, child, undefined)
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
    async *entries(): AsyncIterableIterator<
      [string, FileSystemFileHandle | FileSystemDirectoryHandle]
    > {
      for (const fileName of node.files.keys()) {
        const fileHandle = await handle.getFileHandle(fileName)
        yield [fileName, fileHandle as unknown as FileSystemFileHandle]
      }
      for (const dirName of node.dirs.keys()) {
        const sub = node.dirs.get(dirName)
        if (sub === undefined) {
          continue
        }
        yield [
          dirName,
          toHandle(sub, dirName, createPermissionController('granted')),
        ]
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

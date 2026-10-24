/** Minimal FSA-like handles for photo source roots (binary files). */

export interface AssetFileHandle {
  getFile: () => Promise<File>
}

export interface AssetDirectoryHandle {
  getDirectory: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<AssetDirectoryHandle>
  getFile: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<AssetFileHandle>
  entries: () =>
    | IterableIterator<[string, AssetDirectoryHandle | AssetFileHandle]>
    | AsyncIterableIterator<[string, AssetDirectoryHandle | AssetFileHandle]>
}

/**
 * Adapt a browser `FileSystemDirectoryHandle` to the asset-source protocol.
 * Uses `entries()` when present (Chromium FSA).
 */
export function fromFileSystemDirectoryHandle(
  root: FileSystemDirectoryHandle,
): AssetDirectoryHandle {
  return wrapDirectory(root)
}

function wrapDirectory(
  handle: FileSystemDirectoryHandle,
): AssetDirectoryHandle {
  return {
    async getDirectory(name, options) {
      const dirOptions =
        options?.create === undefined ? undefined : { create: options.create }
      return wrapDirectory(await handle.getDirectoryHandle(name, dirOptions))
    },
    async getFile(name, options) {
      const fileOptions =
        options?.create === undefined ? undefined : { create: options.create }
      const file = await handle.getFileHandle(name, fileOptions)
      return {
        getFile: () => file.getFile(),
      }
    },
    async *entries(): AsyncIterableIterator<
      [string, AssetDirectoryHandle | AssetFileHandle]
    > {
      if (typeof handle.entries === 'function') {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'directory') {
            yield [name, wrapDirectory(entry as FileSystemDirectoryHandle)]
          } else {
            const fileHandle = entry as FileSystemFileHandle
            yield [name, { getFile: () => fileHandle.getFile() }]
          }
        }
        return
      }
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
          yield [entry.name, wrapDirectory(entry as FileSystemDirectoryHandle)]
        } else {
          const fileHandle = entry as FileSystemFileHandle
          yield [entry.name, { getFile: () => fileHandle.getFile() }]
        }
      }
    },
  }
}

/** True for Chromium `FileSystemDirectoryHandle` (has `getDirectoryHandle`). */
export function isBrowserDirectoryHandle(
  value: unknown,
): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getDirectoryHandle' in value &&
    typeof (value as FileSystemDirectoryHandle).getDirectoryHandle ===
      'function'
  )
}

/** Minimal directory/file protocol used by the FSA library adapter. */
export interface LibraryFileHandle {
  getText: () => Promise<string>
  writeText: (text: string) => Promise<void>
  /** UTC epoch ms of last write when the platform exposes it. */
  getLastModifiedMs: () => Promise<number>
}

export type LibraryDirectoryEntry =
  { name: string; kind: 'file' } | { name: string; kind: 'directory' }

export interface LibraryDirectoryHandle {
  getDirectory: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LibraryDirectoryHandle>
  getFile: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LibraryFileHandle>
  removeEntry: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>
  list: () => Promise<LibraryDirectoryEntry[]>
}

/**
 * Adapt a browser `FileSystemDirectoryHandle` to the library protocol.
 * Uses `values()` when present (Chromium FSA).
 */
export function fromFileSystemDirectoryHandle(
  root: FileSystemDirectoryHandle,
): LibraryDirectoryHandle {
  return wrapDirectory(root)
}

function wrapDirectory(
  handle: FileSystemDirectoryHandle,
): LibraryDirectoryHandle {
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
        async getText() {
          return (await file.getFile()).text()
        },
        async writeText(text) {
          const writable = await file.createWritable()
          await writable.write(text)
          await writable.close()
        },
        async getLastModifiedMs() {
          return (await file.getFile()).lastModified
        },
      }
    },
    async removeEntry(name, options) {
      const removeOptions =
        options?.recursive === undefined
          ? undefined
          : { recursive: options.recursive }
      await handle.removeEntry(name, removeOptions)
    },
    async list() {
      const entries: LibraryDirectoryEntry[] = []
      for await (const entry of handle.values()) {
        entries.push({ name: entry.name, kind: entry.kind })
      }
      return entries
    },
  }
}

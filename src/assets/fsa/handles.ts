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
  entries: () => IterableIterator<
    [string, AssetDirectoryHandle | AssetFileHandle]
  >
}

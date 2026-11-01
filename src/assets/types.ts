export interface ScannedEntry {
  relativePath: string
  byteSize: number
  mtimeMs: number
  contentHash?: string
  /**
   * Live `File` from the walk's `getFile()` (directory walks only). Session-only:
   * never persisted; cloning it across the worker boundary copies no bytes.
   */
  file?: File
}

/** Directory-walk entry: always carries the `File` its `getFile()` returned. */
export type WalkedEntry = ScannedEntry & { file: File }

export type AssetSourceFailureCode =
  'permission-required' | 'not-found' | 'corrupted'

export interface AssetSourceFailure {
  ok: false
  code: AssetSourceFailureCode
}

interface AssetSourceSuccess<T> {
  ok: true
  value: T
}

export type AssetSourceResult<T> = AssetSourceSuccess<T> | AssetSourceFailure

export interface AssetSource {
  scanRoot: (rootId: string) => Promise<AssetSourceResult<ScannedEntry[]>>
  /**
   * Resolve a live `File` for session retain / decode without reading the body.
   * Prefer this over `readForHash` when size+mtime identity already matches.
   */
  resolveFile: (
    rootId: string,
    relativePath: string,
  ) => Promise<AssetSourceResult<File>>
  readForHash: (
    rootId: string,
    relativePath: string,
  ) => Promise<AssetSourceResult<ArrayBuffer>>
}

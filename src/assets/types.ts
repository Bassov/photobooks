export interface ScannedEntry {
  relativePath: string
  byteSize: number
  mtimeMs: number
  contentHash?: string
}

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
  readForHash: (
    rootId: string,
    relativePath: string,
  ) => Promise<AssetSourceResult<ArrayBuffer>>
}

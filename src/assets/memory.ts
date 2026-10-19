import { scanMemoryFilesInWorker } from './scanClient'
import type {
  AssetSource,
  AssetSourceFailure,
  AssetSourceFailureCode,
  AssetSourceResult,
  ScannedEntry,
} from './types'

interface MemoryFile {
  bytes: ArrayBuffer
  mtimeMs: number
  corrupted?: boolean
}

export type MemoryAssetSource = AssetSource & {
  seedFile: (
    rootId: string,
    relativePath: string,
    bytes: ArrayBuffer,
    mtimeMs: number,
  ) => void
  seedCorrupted: (rootId: string, relativePath: string) => void
  setPermissionRequired: (required: boolean) => void
}

function failure(code: AssetSourceFailureCode): AssetSourceFailure {
  return { ok: false, code }
}

function success<T>(value: T): AssetSourceResult<T> {
  return { ok: true, value }
}

export function createMemoryAssetSource(): MemoryAssetSource {
  const roots = new Map<string, Map<string, MemoryFile>>()
  let permissionRequired = false

  const gate = <T>(run: () => AssetSourceResult<T>): AssetSourceResult<T> => {
    if (permissionRequired) {
      return failure('permission-required')
    }
    return run()
  }

  const getRoot = (rootId: string): Map<string, MemoryFile> | undefined =>
    roots.get(rootId)

  return {
    seedFile(rootId, relativePath, bytes, mtimeMs) {
      let root = roots.get(rootId)
      if (!root) {
        root = new Map()
        roots.set(rootId, root)
      }
      root.set(relativePath, {
        bytes: bytes.slice(0),
        mtimeMs,
      })
    },
    seedCorrupted(rootId, relativePath) {
      let root = roots.get(rootId)
      if (!root) {
        root = new Map()
        roots.set(rootId, root)
      }
      root.set(relativePath, {
        bytes: new ArrayBuffer(0),
        mtimeMs: 0,
        corrupted: true,
      })
    },
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },
    async scanRoot(rootId) {
      if (permissionRequired) {
        return failure('permission-required')
      }
      const root = getRoot(rootId)
      if (!root) {
        return failure('not-found')
      }
      const files = [...root.entries()]
        .filter(([, file]) => file.corrupted !== true)
        .map(([relativePath, file]) => ({
          relativePath,
          byteSize: file.bytes.byteLength,
          mtimeMs: file.mtimeMs,
        }))
      try {
        const entries: ScannedEntry[] = await scanMemoryFilesInWorker(files)
        return success(entries)
      } catch {
        return failure('corrupted')
      }
    },
    readForHash(rootId, relativePath) {
      return Promise.resolve(
        gate(() => {
          const root = getRoot(rootId)
          if (!root) {
            return failure('not-found')
          }
          const file = root.get(relativePath)
          if (!file) {
            return failure('not-found')
          }
          if (file.corrupted === true) {
            return failure('corrupted')
          }
          return success(file.bytes.slice(0))
        }),
      )
    },
  }
}

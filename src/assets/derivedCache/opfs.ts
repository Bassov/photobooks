import { decodeDerivedCacheEntry, encodeDerivedCacheEntry } from './envelope'
import type {
  DerivedCache,
  DerivedCacheFailure,
  DerivedCacheFailureCode,
  DerivedCacheResult,
} from './types'

const DEFAULT_ROOT_NAME = 'photobooks-derived'

export interface OpfsDerivedCacheOptions {
  /** Injected OPFS (or fake) root; defaults to navigator.storage.getDirectory(). */
  root?: FileSystemDirectoryHandle
  rootName?: string
}

export type OpfsDerivedCache = DerivedCache & {
  seedCorrupted: (assetHash: string, presetId: string) => Promise<void>
}

function failure(code: DerivedCacheFailureCode): DerivedCacheFailure {
  return { ok: false, code }
}

function success<T>(value: T): DerivedCacheResult<T> {
  return { ok: true, value }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

function fileNameFor(assetHash: string, presetId: string): string {
  return `${assetHash}_${encodeURIComponent(presetId)}`
}

async function resolveCacheRoot(
  options: OpfsDerivedCacheOptions,
): Promise<FileSystemDirectoryHandle> {
  if (options.root !== undefined) {
    return options.root
  }
  if (typeof navigator.storage.getDirectory !== 'function') {
    throw new Error('OPFS is not available in this environment')
  }
  const base = await navigator.storage.getDirectory()
  return base.getDirectoryHandle(options.rootName ?? DEFAULT_ROOT_NAME, {
    create: true,
  })
}

export async function createOpfsDerivedCache(
  options: OpfsDerivedCacheOptions = {},
): Promise<OpfsDerivedCache> {
  const root = await resolveCacheRoot(options)

  async function openFile(
    assetHash: string,
    presetId: string,
    create: boolean,
  ): Promise<FileSystemFileHandle> {
    return root.getFileHandle(fileNameFor(assetHash, presetId), { create })
  }

  return {
    async get(assetHash, presetId) {
      try {
        const handle = await openFile(assetHash, presetId, false)
        const file = await handle.getFile()
        const buffer = await file.arrayBuffer()
        const entry = decodeDerivedCacheEntry(buffer)
        if (entry === undefined) {
          return failure('corrupted')
        }
        return success(entry)
      } catch (error) {
        if (isNotFoundError(error)) {
          return failure('not-found')
        }
        return failure('corrupted')
      }
    },

    async put(assetHash, presetId, entry) {
      try {
        const handle = await openFile(assetHash, presetId, true)
        const writable = await handle.createWritable()
        await writable.write(encodeDerivedCacheEntry(entry))
        await writable.close()
        return success(undefined)
      } catch {
        return failure('corrupted')
      }
    },

    async delete(assetHash, presetId) {
      try {
        await root.removeEntry(fileNameFor(assetHash, presetId))
      } catch (error) {
        if (!isNotFoundError(error)) {
          return failure('corrupted')
        }
      }
      return success(undefined)
    },

    async clear() {
      try {
        for await (const entry of root.values()) {
          await root.removeEntry(entry.name)
        }
        return success(undefined)
      } catch {
        return failure('corrupted')
      }
    },

    async seedCorrupted(assetHash, presetId) {
      const handle = await openFile(assetHash, presetId, true)
      const writable = await handle.createWritable()
      // uint32 BE mime length 0 — invalid envelope (mime must be non-empty).
      await writable.write(new Uint8Array([0, 0, 0, 0]).buffer)
      await writable.close()
    },
  }
}

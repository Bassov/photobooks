import { scanDirectoryInWorker } from '../scanClient'
import type {
  AssetSource,
  AssetSourceFailure,
  AssetSourceFailureCode,
  AssetSourceResult,
  ScannedEntry,
} from '../types'
import type { AssetDirectoryHandle, AssetFileHandle } from './handles'
import {
  fromFileSystemDirectoryHandle,
  isBrowserDirectoryHandle,
} from './handles'

export type FsaAssetSource = AssetSource & {
  setPermissionRequired: (required: boolean) => void
}

function failure(code: AssetSourceFailureCode): AssetSourceFailure {
  return { ok: false, code }
}

function success<T>(value: T): AssetSourceResult<T> {
  return { ok: true, value }
}

async function resolveAssetFile(
  root: AssetDirectoryHandle,
  relativePath: string,
): Promise<AssetFileHandle | undefined> {
  const parts = relativePath.split('/').filter((part) => part.length > 0)
  const fileName = parts.pop()
  if (!fileName) {
    return undefined
  }
  let dir = root
  for (const part of parts) {
    try {
      dir = await dir.getDirectory(part)
    } catch {
      return undefined
    }
  }
  try {
    return await dir.getFile(fileName)
  } catch {
    return undefined
  }
}

export function createFsaAssetSource(options: {
  rootId: string
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle
}): FsaAssetSource {
  const { rootId } = options
  const rawDirectory = options.directory
  const directory: AssetDirectoryHandle = isBrowserDirectoryHandle(rawDirectory)
    ? fromFileSystemDirectoryHandle(rawDirectory)
    : rawDirectory
  /** Prefer posting the raw browser handle so the worker can walk via FSA. */
  const scanDirectory: AssetDirectoryHandle | FileSystemDirectoryHandle =
    isBrowserDirectoryHandle(rawDirectory) ? rawDirectory : directory
  let permissionRequired = false

  return {
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },
    async scanRoot(id) {
      if (permissionRequired) {
        return failure('permission-required')
      }
      if (id !== rootId) {
        return failure('not-found')
      }
      try {
        const entries: ScannedEntry[] =
          await scanDirectoryInWorker(scanDirectory)
        return success(entries)
      } catch {
        return failure('corrupted')
      }
    },
    async readForHash(id, relativePath) {
      if (permissionRequired) {
        return failure('permission-required')
      }
      if (id !== rootId) {
        return failure('not-found')
      }
      const handle = await resolveAssetFile(directory, relativePath)
      if (!handle) {
        return failure('not-found')
      }
      try {
        const file = await handle.getFile()
        return success(await file.arrayBuffer())
      } catch {
        return failure('corrupted')
      }
    },
  }
}

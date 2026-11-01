import type { AssetDirectoryHandle, AssetFileHandle } from './fsa/handles'
import { isBrowserDirectoryHandle } from './fsa/handles'
import { isAssetDirectoryHandle } from './fsa/memoryDirectory'
import type { ScannedEntry, WalkedEntry } from './types'

/** Walk a directory handle tree into domain scanned entries (worker-safe). */
export async function walkAssetDirectory(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
  prefix = '',
): Promise<WalkedEntry[]> {
  const out: WalkedEntry[] = []
  if (isBrowserDirectoryHandle(directory)) {
    await walkBrowserInto(directory, prefix, out)
  } else {
    await walkInto(directory, prefix, out)
  }
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return out
}

/** Per-directory cap on concurrent `getFile()` calls during the walk. */
export const SCAN_GET_FILE_CONCURRENCY = 16

interface PendingFile {
  relativePath: string
  handle: Pick<AssetFileHandle, 'getFile'>
}

async function walkInto(
  directory: AssetDirectoryHandle,
  prefix: string,
  out: WalkedEntry[],
): Promise<void> {
  const files: PendingFile[] = []
  for await (const [name, handle] of asAsyncEntries(directory.entries())) {
    const relativePath = prefix.length > 0 ? `${prefix}/${name}` : name
    if (isAssetDirectoryHandle(handle)) {
      await walkInto(handle, relativePath, out)
      continue
    }
    files.push({ relativePath, handle })
  }
  await pushScannedFiles(files, out)
}

async function walkBrowserInto(
  directory: FileSystemDirectoryHandle,
  prefix: string,
  out: WalkedEntry[],
): Promise<void> {
  const files: PendingFile[] = []
  for await (const [name, handle] of browserDirectoryEntries(directory)) {
    const relativePath = prefix.length > 0 ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      await walkBrowserInto(
        handle as FileSystemDirectoryHandle,
        relativePath,
        out,
      )
      continue
    }
    files.push({ relativePath, handle: handle as FileSystemFileHandle })
  }
  await pushScannedFiles(files, out)
}

async function* browserDirectoryEntries(
  directory: FileSystemDirectoryHandle,
): AsyncGenerator<readonly [string, FileSystemHandle], void> {
  if (typeof directory.entries === 'function') {
    for await (const entry of directory.entries()) {
      yield entry
    }
    return
  }
  for await (const entry of directory.values()) {
    yield [entry.name, entry] as const
  }
}

async function* asAsyncEntries(
  entries:
    | IterableIterator<[string, AssetDirectoryHandle | AssetFileHandle]>
    | AsyncIterableIterator<[string, AssetDirectoryHandle | AssetFileHandle]>,
): AsyncGenerator<[string, AssetDirectoryHandle | AssetFileHandle], void> {
  yield* entries
}

/**
 * `getFile()` one directory's files with bounded parallelism. Entries keep the
 * live `File` so rescan verify need not resolve each path again.
 */
async function pushScannedFiles(
  files: readonly PendingFile[],
  out: WalkedEntry[],
): Promise<void> {
  // Lanes share one iterator, so each file is taken exactly once.
  const queue = files.values()
  const lane = async (): Promise<void> => {
    for (const { relativePath, handle } of queue) {
      try {
        const file = await handle.getFile()
        out.push({
          relativePath,
          byteSize: file.size,
          mtimeMs: file.lastModified,
          file,
        })
      } catch {
        // Skip unreadable entries; readForHash surfaces corrupted.
      }
    }
  }
  await Promise.all(Array.from({ length: SCAN_GET_FILE_CONCURRENCY }, lane))
}

/** Normalize a pre-listed memory file table into sorted scanned entries. */
export function finalizeMemoryScanEntries(
  files: readonly {
    relativePath: string
    byteSize: number
    mtimeMs: number
  }[],
): ScannedEntry[] {
  const entries: ScannedEntry[] = files.map((file) => ({
    relativePath: file.relativePath,
    byteSize: file.byteSize,
    mtimeMs: file.mtimeMs,
  }))
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return entries
}

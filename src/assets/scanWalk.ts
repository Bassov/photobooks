import type { AssetDirectoryHandle, AssetFileHandle } from './fsa/handles'
import { isBrowserDirectoryHandle } from './fsa/handles'
import { isAssetDirectoryHandle } from './fsa/memoryDirectory'
import type { ScannedEntry } from './types'

/** Walk a directory handle tree into domain scanned entries (worker-safe). */
export async function walkAssetDirectory(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
  prefix = '',
): Promise<ScannedEntry[]> {
  const out: ScannedEntry[] = []
  if (isBrowserDirectoryHandle(directory)) {
    await walkBrowserInto(directory, prefix, out)
  } else {
    await walkInto(directory, prefix, out)
  }
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return out
}

async function walkInto(
  directory: AssetDirectoryHandle,
  prefix: string,
  out: ScannedEntry[],
): Promise<void> {
  for await (const [name, handle] of asAsyncEntries(directory.entries())) {
    const relativePath = prefix.length > 0 ? `${prefix}/${name}` : name
    if (isAssetDirectoryHandle(handle)) {
      await walkInto(handle, relativePath, out)
      continue
    }
    await pushScannedFile(handle, relativePath, out)
  }
}

async function walkBrowserInto(
  directory: FileSystemDirectoryHandle,
  prefix: string,
  out: ScannedEntry[],
): Promise<void> {
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
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      out.push({
        relativePath,
        byteSize: file.size,
        mtimeMs: file.lastModified,
      })
    } catch {
      // Skip unreadable entries; readForHash surfaces corrupted.
    }
  }
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

async function pushScannedFile(
  handle: AssetFileHandle,
  relativePath: string,
  out: ScannedEntry[],
): Promise<void> {
  try {
    const file = await handle.getFile()
    out.push({
      relativePath,
      byteSize: file.size,
      mtimeMs: file.lastModified,
    })
  } catch {
    // Skip unreadable entries; readForHash surfaces corrupted.
  }
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

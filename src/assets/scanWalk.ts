import type { AssetDirectoryHandle } from './fsa/handles'
import { isAssetDirectoryHandle } from './fsa/memoryDirectory'
import type { ScannedEntry } from './types'

/** Walk a directory handle tree into domain scanned entries (worker-safe). */
export async function walkAssetDirectory(
  directory: AssetDirectoryHandle,
  prefix = '',
): Promise<ScannedEntry[]> {
  const out: ScannedEntry[] = []
  await walkInto(directory, prefix, out)
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return out
}

async function walkInto(
  directory: AssetDirectoryHandle,
  prefix: string,
  out: ScannedEntry[],
): Promise<void> {
  for (const [name, handle] of directory.entries()) {
    const relativePath = prefix.length > 0 ? `${prefix}/${name}` : name
    if (isAssetDirectoryHandle(handle)) {
      await walkInto(handle, relativePath, out)
      continue
    }
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

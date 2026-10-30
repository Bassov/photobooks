const DEFAULT_ROOT_NAME = 'photobooks-derived'

export interface OpfsUsageOptions {
  /** Injected directory (tests); defaults to the OPFS derived-cache root. */
  root?: FileSystemDirectoryHandle
}

/** Total bytes of the derived (preview) cache directory; null when OPFS is unavailable. */
export async function measureDerivedCacheBytes(
  options: OpfsUsageOptions = {},
): Promise<number | null> {
  try {
    let dir = options.root
    if (dir === undefined) {
      if (typeof navigator.storage.getDirectory !== 'function') {
        return null
      }
      const base = await navigator.storage.getDirectory()
      dir = await base.getDirectoryHandle(DEFAULT_ROOT_NAME, { create: true })
    }
    let total = 0
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        total += (await (entry as FileSystemFileHandle).getFile()).size
      }
    }
    return total
  } catch {
    return null
  }
}

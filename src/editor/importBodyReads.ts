import type { Asset } from '../core'

/** Matches `runImportBatch` START_CHUNK — max in-flight body reads for seed/hash. */
export const IMPORT_BODY_READ_CAP = 16

export function relativePathFor(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath
  if (typeof relative === 'string' && relative.length > 0) {
    return relative
  }
  return file.name
}

export function reuseIdentityKey(
  relativePath: string,
  byteSize: number,
  mtimeMs: number,
): string {
  return `${relativePath}\0${String(byteSize)}\0${String(mtimeMs)}`
}

/** Index gallery assets by path+size+mtime for O(1) re-import reuse. */
export function buildReuseIndex(
  gallery: readonly string[],
  assets: Readonly<Record<string, Asset | undefined>>,
): Map<string, string> {
  const index = new Map<string, string>()
  for (const assetId of gallery) {
    const asset = assets[assetId]
    if (asset === undefined) {
      continue
    }
    if (
      asset.relativePath === undefined ||
      asset.byteSize === undefined ||
      asset.mtimeMs === undefined
    ) {
      continue
    }
    const key = reuseIdentityKey(
      asset.relativePath,
      asset.byteSize,
      asset.mtimeMs,
    )
    if (!index.has(key)) {
      index.set(key, assetId)
    }
  }
  return index
}

/** Reuse gallery asset when path + size + mtime match (re-import / restore thumbs). */
export function findReusableAssetId(
  gallery: readonly string[],
  assets: Readonly<Record<string, Asset | undefined>>,
  relativePath: string,
  byteSize: number,
  mtimeMs: number,
): string | undefined {
  return buildReuseIndex(gallery, assets).get(
    reuseIdentityKey(relativePath, byteSize, mtimeMs),
  )
}

/** Run async work over items with at most `concurrency` in flight. */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return
  }
  const limit = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex
        nextIndex += 1
        // Index is always in range while `nextIndex < items.length`.
        await fn(items[index] as T)
      }
    }),
  )
}

/** Shared body-read gate so seed + hash-fallback never exceed the cap together. */
export function createBodyReadGate(limit: number = IMPORT_BODY_READ_CAP): {
  withBodyRead: <T>(fn: () => Promise<T>) => Promise<T>
  inFlight: () => number
} {
  const max = Math.max(1, limit)
  let inFlight = 0
  const waiters: (() => void)[] = []

  async function acquire(): Promise<void> {
    while (inFlight >= max) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    }
    inFlight += 1
  }

  function release(): void {
    inFlight -= 1
    const next = waiters.shift()
    next?.()
  }

  return {
    inFlight: () => inFlight,
    withBodyRead: async <T>(fn: () => Promise<T>): Promise<T> => {
      await acquire()
      try {
        return await fn()
      } finally {
        release()
      }
    },
  }
}

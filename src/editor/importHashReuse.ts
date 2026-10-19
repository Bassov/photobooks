import { hashContent } from '../assets'
import { retainAssetSource } from '../photo/assetSources'
import { getBookStoreSnapshot, mintAssetId } from './bookStore'
import { IMPORT_BODY_READ_CAP, mapWithConcurrency } from './importBodyReads'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'

export interface HashReusePrepared {
  assetId: string
  file: File
  relativePath: string
  reused: boolean
  bytes: ArrayBuffer
  contentHash: string
}

export interface HashResolveJob {
  file: File
  relativePath: string
  index: number
}

/**
 * For path+size+mtime misses when the gallery already has contentHashes:
 * read+hash under `withBodyRead`, reuse matching ids or mint new ones.
 * Never enqueues a placeholder before the hash decision (no flash-then-remove).
 */
export async function resolveByContentHash(options: {
  jobs: readonly HashResolveJob[]
  hashIndex: Map<string, string>
  batchRootId: string
  withBodyRead: <T>(fn: () => Promise<T>) => Promise<T>
  enqueueNew: (entry: HashReusePrepared) => void
}): Promise<HashReusePrepared[]> {
  const { jobs, hashIndex, batchRootId, withBodyRead, enqueueNew } = options
  if (jobs.length === 0) {
    return []
  }
  const slots: (HashReusePrepared | undefined)[] = Array.from({
    length: jobs.length,
  })
  await mapWithConcurrency(jobs, IMPORT_BODY_READ_CAP, async (job) => {
    await withBodyRead(async () => {
      const { file, relativePath, index } = job
      const bytes = await file.arrayBuffer()
      const contentHash = await hashContent(bytes)
      const existingId = hashIndex.get(contentHash)
      if (existingId !== undefined) {
        retainAssetSource(existingId, file)
        const existingRoot =
          getBookStoreSnapshot().book.assets[existingId]?.sourceRootId
        const sourceRootId = existingRoot ?? batchRootId
        const prepared: HashReusePrepared = {
          assetId: existingId,
          file,
          relativePath,
          reused: true,
          bytes,
          contentHash,
        }
        slots[index] = prepared
        await seedAndHashEntry({
          assetId: existingId,
          file,
          relativePath,
          sourceRootId,
          memorySource: memorySourceForRoot(sourceRootId),
          bytes,
          contentHash,
        })
        return
      }

      const assetId = mintAssetId(file.name)
      retainAssetSource(assetId, file)
      const prepared: HashReusePrepared = {
        assetId,
        file,
        relativePath,
        reused: false,
        bytes,
        contentHash,
      }
      enqueueNew(prepared)
      hashIndex.set(contentHash, assetId)
      slots[index] = prepared
      await seedAndHashEntry({
        assetId,
        file,
        relativePath,
        sourceRootId: batchRootId,
        memorySource: memorySourceForRoot(batchRootId),
        bytes,
        contentHash,
      })
    })
  })
  return slots.filter(
    (entry): entry is HashReusePrepared => entry !== undefined,
  )
}

import type { ImportFileError } from '../photo/assetPool'
import { importPhotoFiles, type ImportProgress } from './importPhotos'

export interface ChromeImportResult {
  imported: number
  errors: readonly ImportFileError[]
  skipped: number
}

export async function runChromeImport(
  files: readonly File[],
  options: {
    onProgress: (progress: ImportProgress | null) => void
    onErrors: (errors: readonly ImportFileError[]) => void
    source?: 'files' | 'folder'
    sourceRootId?: string
    libraryBacked?: boolean
    awaitPriorHashes?: boolean
    listAlreadyEnqueued?: boolean
    manageImportRunning?: boolean
  },
): Promise<ChromeImportResult> {
  if (files.length === 0) {
    return { imported: 0, errors: [], skipped: 0 }
  }
  let raf = 0
  let latest!: ImportProgress
  const onProgress = (state: ImportProgress): void => {
    latest = state
    if (raf !== 0) {
      return
    }
    raf = requestAnimationFrame(() => {
      raf = 0
      options.onProgress(latest)
    })
  }
  const reportedErrorIds = new Set<string>()
  const reportErrors = (errors: readonly ImportFileError[]): void => {
    const fresh = errors.filter((error) => {
      if (reportedErrorIds.has(error.id)) {
        return false
      }
      reportedErrorIds.add(error.id)
      return true
    })
    if (fresh.length === 0) {
      return
    }
    options.onErrors(fresh)
  }
  const result = await importPhotoFiles(files, {
    onProgress,
    onDecodeError: (error) => {
      reportErrors([error])
    },
    source: options.source ?? 'folder',
    ...(options.sourceRootId !== undefined
      ? { sourceRootId: options.sourceRootId }
      : {}),
    ...(options.libraryBacked !== undefined
      ? { libraryBacked: options.libraryBacked }
      : {}),
    ...(options.awaitPriorHashes !== undefined
      ? { awaitPriorHashes: options.awaitPriorHashes }
      : {}),
    ...(options.listAlreadyEnqueued !== undefined
      ? { listAlreadyEnqueued: options.listAlreadyEnqueued }
      : {}),
    ...(options.manageImportRunning !== undefined
      ? { manageImportRunning: options.manageImportRunning }
      : {}),
  })
  if (raf !== 0) {
    cancelAnimationFrame(raf)
  }
  reportErrors(result.errors)
  if (reportedErrorIds.size === 0) {
    // Keep the empty call so callers can clear toasts / reset error UI.
    options.onErrors([])
    options.onProgress(null)
    return result
  }
  options.onProgress({
    total: result.imported + result.errors.length,
    completed: result.imported + result.errors.length,
    errors: result.errors,
    running: false,
  })
  return result
}

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
  const result = await importPhotoFiles(files, {
    onProgress,
    source: options.source ?? 'folder',
    ...(options.sourceRootId !== undefined
      ? { sourceRootId: options.sourceRootId }
      : {}),
    ...(options.libraryBacked !== undefined
      ? { libraryBacked: options.libraryBacked }
      : {}),
  })
  if (raf !== 0) {
    cancelAnimationFrame(raf)
  }
  options.onErrors(result.errors)
  if (result.errors.length === 0) {
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

import type { ImportFileError } from '../photo/assetPool'
import type { PhotobooksToastQueue, ToastContent } from '../ui/toastQueue'

export const IMPORT_ERROR_TOAST_TIMEOUT_MS = 60_000

export function importErrorsToastContent(
  errors: readonly ImportFileError[],
  onShowFiles: () => void,
): ToastContent {
  const count = errors.length
  const title =
    count === 1
      ? "1 file couldn't be read"
      : `${String(count)} files couldn't be read`
  const description = errors
    .map((error) => {
      const detail = error.message
      return detail.length === 0 ? error.name : `${error.name} — ${detail}`
    })
    .join('; ')
  return {
    title,
    description,
    tone: 'error',
    testId: 'import-errors',
    action: { label: 'Show files', onAction: onShowFiles },
  }
}

export function enqueueImportErrorsToast(
  queue: PhotobooksToastQueue,
  errors: readonly ImportFileError[],
  onShowFiles: () => void,
): void {
  queue.clear()
  if (errors.length === 0) {
    return
  }
  queue.add(importErrorsToastContent(errors, onShowFiles), {
    timeout: IMPORT_ERROR_TOAST_TIMEOUT_MS,
  })
}

export function clearImportErrorsToast(queue: PhotobooksToastQueue): void {
  queue.clear()
}

export function importErrorsStatusText(
  errors: readonly ImportFileError[],
): string {
  return errors.map((error) => `${error.name}: ${error.message}`).join('; ')
}

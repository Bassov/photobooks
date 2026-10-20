import type { PhotobooksToastQueue } from './toastQueue'
import type { ToastContent } from './toastQueue'

export function errorToastContent(onAction: () => void): ToastContent {
  return {
    title: '3 files skipped',
    description: 'Unsupported format',
    tone: 'error',
    action: { label: 'Show files', onAction },
  }
}

export function successToastContent(): ToastContent {
  return { title: 'Library saved', tone: 'success' }
}

export function enqueueSpecimenErrorToast(
  queue: PhotobooksToastQueue,
  onAction: () => void,
): void {
  queue.add(errorToastContent(onAction), { timeout: 8000 })
}

export function enqueueSpecimenSuccessToast(queue: PhotobooksToastQueue): void {
  queue.add(successToastContent(), { timeout: 4000 })
}

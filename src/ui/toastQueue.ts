import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastContent {
  title: string
  description?: string
  tone?: ToastTone
  action?: { label: string; onAction?: () => void }
}

/** Shared toast queue for a surface (specimen, later editor chrome). */
export function createToastQueue() {
  return new ToastQueue<ToastContent>()
}

export type PhotobooksToastQueue = ReturnType<typeof createToastQueue>

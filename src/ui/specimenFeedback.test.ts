import { describe, expect, it, vi } from 'vitest'
import {
  enqueueSpecimenErrorToast,
  enqueueSpecimenSuccessToast,
  errorToastContent,
  successToastContent,
} from './specimenFeedback'
import { createToastQueue } from './toastQueue'

describe('specimenFeedback', () => {
  it('builds error and success toast payloads', () => {
    const onAction = vi.fn()
    expect(errorToastContent(onAction)).toEqual({
      title: '3 files skipped',
      description: 'Unsupported format',
      tone: 'error',
      action: { label: 'Show files', onAction },
    })
    expect(successToastContent()).toEqual({
      title: 'Library saved',
      tone: 'success',
    })
  })

  it('enqueues toasts on the shared queue', () => {
    const queue = createToastQueue()
    const add = vi.spyOn(queue, 'add')
    const onAction = vi.fn()

    enqueueSpecimenErrorToast(queue, onAction)
    expect(add).toHaveBeenCalledWith(errorToastContent(onAction), {
      timeout: 8000,
    })

    enqueueSpecimenSuccessToast(queue)
    expect(add).toHaveBeenCalledWith(successToastContent(), { timeout: 4000 })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createToastQueue } from '../ui/toastQueue'
import {
  IMPORT_ERROR_TOAST_TIMEOUT_MS,
  clearImportErrorsToast,
  enqueueImportErrorsToast,
  importErrorsStatusText,
  importErrorsToastContent,
} from './importErrorToast'

describe('importErrorToast', () => {
  it('builds a singular error toast with Show files action', () => {
    const onShow = vi.fn()
    const content = importErrorsToastContent(
      [{ name: 'bad.jpg', message: 'Unsupported' }],
      onShow,
    )
    expect(content.title).toBe("1 file couldn't be read")
    expect(content.description).toBe('bad.jpg — Unsupported')
    expect(content.tone).toBe('error')
    expect(content.testId).toBe('import-errors')
    content.action?.onAction?.()
    expect(onShow).toHaveBeenCalledOnce()
  })

  it('omits the detail suffix when the first message is empty', () => {
    const content = importErrorsToastContent(
      [{ name: 'bad.jpg', message: '' }],
      () => undefined,
    )
    expect(content.description).toBe('bad.jpg')
  })

  it('builds a plural title and status text for multiple errors', () => {
    const errors = [
      { name: 'a.tif', message: 'Unsupported' },
      { name: 'b.jpg', message: 'decode failed' },
    ]
    const content = importErrorsToastContent(errors, () => undefined)
    expect(content.title).toBe("2 files couldn't be read")
    expect(importErrorsStatusText(errors)).toBe(
      'a.tif: Unsupported; b.jpg: decode failed',
    )
  })

  it('clears prior toasts before enqueue and uses the long timeout', () => {
    const queue = createToastQueue()
    const add = vi.spyOn(queue, 'add')
    const clear = vi.spyOn(queue, 'clear')
    enqueueImportErrorsToast(
      queue,
      [{ name: 'bad.jpg', message: 'Unsupported' }],
      () => undefined,
    )
    expect(clear).toHaveBeenCalled()
    expect(add).toHaveBeenCalledWith(expect.any(Object), {
      timeout: IMPORT_ERROR_TOAST_TIMEOUT_MS,
    })
    expect(queue.visibleToasts).toHaveLength(1)
    expect(queue.visibleToasts[0]?.content.testId).toBe('import-errors')
    clearImportErrorsToast(queue)
    expect(queue.visibleToasts).toHaveLength(0)
  })

  it('clears without enqueueing when the error list is empty', () => {
    const queue = createToastQueue()
    const add = vi.spyOn(queue, 'add')
    enqueueImportErrorsToast(queue, [], () => undefined)
    expect(add).not.toHaveBeenCalled()
    expect(queue.visibleToasts).toHaveLength(0)
  })
})

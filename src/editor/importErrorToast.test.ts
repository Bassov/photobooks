import { describe, expect, it, vi } from 'vitest'
import { createToastQueue } from '../ui/toastQueue'
import { makeImportFileError } from './importFileError.test-helpers'
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
      [
        makeImportFileError({
          name: 'bad.jpg',
          message: 'Unsupported',
          reason: 'unsupported-type',
        }),
      ],
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
      [
        makeImportFileError({
          name: 'bad.jpg',
          message: '',
          reason: 'unsupported-type',
        }),
      ],
      () => undefined,
    )
    expect(content.description).toBe('bad.jpg')
  })

  it('tolerates an empty error list without reading message fields', () => {
    const content = importErrorsToastContent([], () => undefined)
    expect(content.title).toBe("0 files couldn't be read")
    expect(content.description).toBe('')
  })

  it('builds a plural title and status text for multiple errors', () => {
    const errors = [
      makeImportFileError({
        name: 'a.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'b.jpg',
        message: 'decode failed',
        reason: 'decode-failed',
      }),
    ]
    const content = importErrorsToastContent(errors, () => undefined)
    expect(content.title).toBe("2 files couldn't be read")
    expect(content.description).toBe(
      'a.tif — Unsupported; b.jpg — decode failed',
    )
    expect(importErrorsStatusText(errors)).toBe(
      'a.tif: Unsupported; b.jpg: decode failed',
    )
  })

  it('does not reuse the first failure message for every file in the toast', () => {
    const heicMessage =
      'HEIC isn’t supported yet. Export it as JPEG from Photos, or open another file.'
    const content = importErrorsToastContent(
      [
        makeImportFileError({
          name: 'scan_0042.heic',
          message: heicMessage,
          reason: 'heic',
        }),
        makeImportFileError({
          name: 'broken.jpg',
          message: "Couldn't decode this file",
          reason: 'decode-failed',
        }),
      ],
      () => undefined,
    )
    expect(content.description).toBe(
      `scan_0042.heic — ${heicMessage}; broken.jpg — Couldn't decode this file`,
    )
    expect(content.description).not.toContain(`broken.jpg — ${heicMessage}`)
  })

  it('clears prior toasts before enqueue and uses the long timeout', () => {
    const queue = createToastQueue()
    const add = vi.spyOn(queue, 'add')
    const clear = vi.spyOn(queue, 'clear')
    enqueueImportErrorsToast(
      queue,
      [
        makeImportFileError({
          name: 'bad.jpg',
          message: 'Unsupported',
          reason: 'unsupported-type',
        }),
      ],
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

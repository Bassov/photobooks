import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  makeImportFileError,
  resetImportFileErrorTestIds,
} from './importFileError.test-helpers'
import {
  appendImportErrors,
  clearImportErrors,
  closeImportErrorsPanel,
  dismissImportError,
  getImportErrorGroups,
  getImportErrors,
  isImportErrorsPanelOpen,
  openImportErrorsPanel,
  resetImportErrorsStoreForTests,
  setImportErrorsPanelOpen,
  subscribeImportErrors,
} from './importErrorsStore'

describe('importErrorsStore', () => {
  afterEach(() => {
    resetImportErrorsStoreForTests()
    resetImportFileErrorTestIds()
  })

  it('appends batches without wiping prior errors', () => {
    const first = makeImportFileError({
      name: 'a.tif',
      message: 'Unsupported',
      reason: 'unsupported-type',
    })
    const second = makeImportFileError({
      name: 'b.jpg',
      message: 'decode failed',
      reason: 'decode-failed',
      assetId: 'asset-b',
    })
    appendImportErrors([first])
    const snap = getImportErrors()
    appendImportErrors([second])
    expect(getImportErrors()).toEqual([first, second])
    expect(getImportErrors()).not.toBe(snap)
  })

  it('dismisses by id and clear empties the list', () => {
    const a = makeImportFileError({
      name: 'a.tif',
      message: 'Unsupported',
      reason: 'unsupported-type',
    })
    const b = makeImportFileError({
      name: 'b.heic',
      message: 'Unsupported',
      reason: 'heic',
    })
    appendImportErrors([a, b])
    dismissImportError(a.id)
    expect(getImportErrors()).toEqual([b])
    clearImportErrors()
    expect(getImportErrors()).toEqual([])
  })

  it('groups by reason once per mutation with stable snapshots', () => {
    appendImportErrors([
      makeImportFileError({
        name: 'a.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'b.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
      makeImportFileError({
        name: 'c.jpg',
        message: 'decode failed',
        reason: 'decode-failed',
      }),
    ])
    const groups = getImportErrorGroups()
    expect(groups).toHaveLength(2)
    expect(groups[0]?.reason).toBe('unsupported-type')
    expect(groups[0]?.label).toContain('Unsupported format (2)')
    expect(groups[0]?.errors).toHaveLength(2)
    expect(groups[1]?.reason).toBe('decode-failed')
    expect(groups[1]?.errors).toHaveLength(1)
    expect(getImportErrorGroups()).toBe(groups)
  })

  it('no-ops dismiss/clear/append when nothing changes', () => {
    const empty = getImportErrors()
    const emptyGroups = getImportErrorGroups()
    appendImportErrors([])
    dismissImportError('missing')
    clearImportErrors()
    expect(getImportErrors()).toBe(empty)
    expect(getImportErrorGroups()).toBe(emptyGroups)
  })

  it('opens and closes the panel with no-op guards and notifies listeners', () => {
    const listener = vi.fn()
    const unsub = subscribeImportErrors(listener)
    expect(isImportErrorsPanelOpen()).toBe(false)
    openImportErrorsPanel()
    expect(isImportErrorsPanelOpen()).toBe(true)
    expect(listener).toHaveBeenCalled()
    const calls = listener.mock.calls.length
    openImportErrorsPanel()
    expect(listener.mock.calls.length).toBe(calls)
    setImportErrorsPanelOpen(false)
    expect(isImportErrorsPanelOpen()).toBe(false)
    const afterClose = listener.mock.calls.length
    closeImportErrorsPanel()
    expect(listener.mock.calls.length).toBe(afterClose)
    setImportErrorsPanelOpen(true)
    expect(isImportErrorsPanelOpen()).toBe(true)
    unsub()
    const afterUnsub = listener.mock.calls.length
    closeImportErrorsPanel()
    openImportErrorsPanel()
    expect(listener.mock.calls.length).toBe(afterUnsub)
  })

  it('keeps the snapshot when dismiss targets a missing id', () => {
    const error = makeImportFileError({
      name: 'a.tif',
      message: 'Unsupported',
      reason: 'unsupported-type',
    })
    appendImportErrors([error])
    const snap = getImportErrors()
    dismissImportError('nope')
    expect(getImportErrors()).toBe(snap)
    dismissImportError(error.id)
    expect(getImportErrors()).toEqual([])
  })

  it('notifies subscribers from reset', () => {
    const listener = vi.fn()
    subscribeImportErrors(listener)
    appendImportErrors([
      makeImportFileError({
        name: 'a.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
    ])
    listener.mockClear()
    resetImportErrorsStoreForTests()
    expect(listener).toHaveBeenCalled()
    expect(getImportErrors()).toEqual([])
  })
})

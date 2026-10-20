import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearRelinkFound,
  getFoundRelinkIds,
  getRelinkProgress,
  getRelinkStatus,
  markRelinkFound,
  missingCount,
  problemAssetIds,
  replaceRelinkStatuses,
  resetRelinkStore,
  setRelinkDialogOpen,
  setRelinkProgress,
  isRelinkDialogOpen,
  patchRelinkStatus,
  subscribeRelink,
} from './statusStore'

describe('relink statusStore', () => {
  afterEach(() => {
    resetRelinkStore()
  })

  it('tracks missing and modified problem ids', () => {
    replaceRelinkStatuses(
      new Map([
        ['a', 'missing'],
        ['b', 'modified'],
        ['c', 'ok'],
      ]),
    )

    expect(problemAssetIds().sort()).toEqual(['a', 'b'])
    expect(missingCount()).toBe(1)
    expect(getRelinkStatus('a')).toBe('missing')
  })

  it('marks found ids without clearing status', () => {
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    markRelinkFound(['a'])

    expect(getFoundRelinkIds().has('a')).toBe(true)
    expect(getRelinkStatus('a')).toBe('missing')
  })

  it('toggles dialog open', () => {
    expect(isRelinkDialogOpen()).toBe(false)
    setRelinkDialogOpen(true)
    expect(isRelinkDialogOpen()).toBe(true)
    setRelinkDialogOpen(true)
    expect(isRelinkDialogOpen()).toBe(true)
    setRelinkDialogOpen(false)
    expect(isRelinkDialogOpen()).toBe(false)
  })

  it('replaceRelinkStatuses clears prior keys', () => {
    replaceRelinkStatuses(new Map([['old', 'missing']]))
    replaceRelinkStatuses(new Map([['new', 'modified']]))
    expect(getRelinkStatus('old')).toBeUndefined()
    expect(getRelinkStatus('new')).toBe('modified')
  })

  it('clearRelinkFound is a no-op when empty then clears when set', () => {
    clearRelinkFound()
    expect(getFoundRelinkIds().size).toBe(0)
    markRelinkFound(['x'])
    clearRelinkFound()
    expect(getFoundRelinkIds().size).toBe(0)
  })

  it('patchRelinkStatus skips emit when unchanged', () => {
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    patchRelinkStatus('a', 'missing')
    expect(getRelinkStatus('a')).toBe('missing')
    patchRelinkStatus('a', 'modified')
    expect(getRelinkStatus('a')).toBe('modified')
  })

  it('setRelinkProgress stores progress', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    setRelinkProgress({ total: 2, completed: 1, running: true })
    expect(getRelinkProgress()).toEqual({
      total: 2,
      completed: 1,
      running: true,
    })
    setRelinkProgress(null)
    expect(getRelinkProgress()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('notifies subscribers on status and dialog changes', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    const listener = vi.fn()
    const unsub = subscribeRelink(listener)
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    setRelinkDialogOpen(true)
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    setRelinkDialogOpen(true)
    expect(listener).not.toHaveBeenCalled()
    markRelinkFound(['a'])
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    clearRelinkFound()
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    clearRelinkFound()
    expect(listener).not.toHaveBeenCalled()
    setRelinkProgress({ total: 1, completed: 0, running: true })
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    patchRelinkStatus('a', 'modified')
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    patchRelinkStatus('a', 'modified')
    expect(listener).not.toHaveBeenCalled()
    unsub()
    vi.unstubAllGlobals()
  })

  it('resetRelinkStore clears statuses found dialog and progress', () => {
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    markRelinkFound(['a'])
    setRelinkDialogOpen(true)
    setRelinkProgress({ total: 1, completed: 1, running: false })
    const listener = vi.fn()
    const unsub = subscribeRelink(listener)
    resetRelinkStore()
    expect(listener).toHaveBeenCalled()
    expect(getRelinkStatus('a')).toBeUndefined()
    expect(getFoundRelinkIds().size).toBe(0)
    expect(isRelinkDialogOpen()).toBe(false)
    expect(getRelinkProgress()).toBeNull()
    expect(problemAssetIds()).toEqual([])
    expect(missingCount()).toBe(0)
    unsub()
    listener.mockClear()
    replaceRelinkStatuses(new Map([['b', 'missing']]))
    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribe removes the listener', () => {
    const listener = vi.fn()
    const unsub = subscribeRelink(listener)
    unsub()
    replaceRelinkStatuses(new Map([['a', 'missing']]))
    expect(listener).not.toHaveBeenCalled()
  })
})

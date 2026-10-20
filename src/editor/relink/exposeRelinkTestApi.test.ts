import { afterEach, describe, expect, it } from 'vitest'

import {
  exposeRelinkTestApi,
  replaceRelinkStatusesFrom,
} from './exposeRelinkTestApi'
import {
  getRelinkStatus,
  isRelinkDialogOpen,
  resetRelinkStore,
} from './statusStore'

describe('exposeRelinkTestApi', () => {
  afterEach(() => {
    resetRelinkStore()
    delete (window as { __photobooksRelink?: unknown }).__photobooksRelink
  })

  it('attaches detect/rescan/resolve seams on window', () => {
    exposeRelinkTestApi(window)
    const api = window.__photobooksRelink
    expect(api).toEqual(
      expect.objectContaining({
        detectMissingAssets: expect.any(Function),
        rescanRelinkFiles: expect.any(Function),
        resolvePendingRelink: expect.any(Function),
        resetRelinkStore: expect.any(Function),
        setRelinkDialogOpen: expect.any(Function),
        setRelinkProgress: expect.any(Function),
        replaceRelinkStatuses: expect.any(Function),
        problemAssetIds: expect.any(Function),
        clearLiveAssetSources: expect.any(Function),
      }),
    )
    api?.setRelinkDialogOpen(true)
    expect(isRelinkDialogOpen()).toBe(true)
    api?.replaceRelinkStatuses([['a', 'missing']])
    expect(getRelinkStatus('a')).toBe('missing')
    api?.resetRelinkStore()
    expect(api?.problemAssetIds()).toEqual([])
  })

  it('replaceRelinkStatusesFrom accepts Map and iterable entries', () => {
    replaceRelinkStatusesFrom(new Map([['b', 'modified']]))
    expect(getRelinkStatus('b')).toBe('modified')
    replaceRelinkStatusesFrom([['c', 'ok']])
    expect(getRelinkStatus('c')).toBe('ok')
    expect(getRelinkStatus('b')).toBeUndefined()
  })
})

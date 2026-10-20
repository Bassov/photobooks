import { afterEach, describe, expect, it } from 'vitest'

import { exposeRelinkTestApi } from './exposeRelinkTestApi'
import { resetRelinkStore } from './statusStore'

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
        problemAssetIds: expect.any(Function),
        clearLiveAssetSources: expect.any(Function),
      }),
    )
    api?.setRelinkDialogOpen(true)
    api?.resetRelinkStore()
    expect(api?.problemAssetIds()).toEqual([])
  })
})

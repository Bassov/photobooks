import { afterEach, describe, expect, it, vi } from 'vitest'

import { retainAssetSource, resetAssetSources } from '../../photo/assetSources'
import { getBookStoreSnapshot, resetBookStore } from '../bookStore'
import * as projectSession from '../projectSession'
import {
  installRelinkAutoDetect,
  relinkDetectKey,
  resetRelinkAutoDetect,
  syncRelinkAutoDetect,
} from './autoDetect'
import * as detect from './detect'
import {
  getRelinkStatus,
  isRelinkDialogOpen,
  resetRelinkStore,
} from './statusStore'

describe('autoDetect', () => {
  afterEach(() => {
    resetRelinkAutoDetect()
    resetRelinkStore()
    resetAssetSources()
    resetBookStore()
    vi.restoreAllMocks()
  })

  it('relinkDetectKey joins book id, gallery, import, and sourced count', () => {
    expect(relinkDetectKey(null, 'a\0b', false, 0)).toBe(':a\0b:0:0')
    expect(relinkDetectKey('book-1', 'x', true, 2)).toBe('book-1:x:1:2')
  })

  it('syncRelinkAutoDetect is a no-op on home', () => {
    const spy = vi.spyOn(detect, 'detectMissingAssets')
    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'home',
      bookId: null,
      restorePending: false,
      accessPhase: 'idle',
    })
    syncRelinkAutoDetect()
    expect(spy).not.toHaveBeenCalled()
  })

  it('syncRelinkAutoDetect detects once per book+gallery key', () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['a1'],
        assets: {
          a1: {
            contentHash:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'editor',
      bookId: 'book-1',
      restorePending: false,
      accessPhase: 'idle',
    })

    syncRelinkAutoDetect()
    expect(getRelinkStatus('a1')).toBe('missing')
    expect(isRelinkDialogOpen()).toBe(true)

    const spy = vi.spyOn(detect, 'detectMissingAssets')
    syncRelinkAutoDetect()
    expect(spy).not.toHaveBeenCalled()
  })

  it('skips when restorePending or permission-required', () => {
    const spy = vi.spyOn(detect, 'detectMissingAssets')
    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'editor',
      bookId: 'book-1',
      restorePending: true,
      accessPhase: 'idle',
    })
    syncRelinkAutoDetect()
    expect(spy).not.toHaveBeenCalled()

    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'editor',
      bookId: 'book-1',
      restorePending: false,
      accessPhase: 'permission-required',
    })
    syncRelinkAutoDetect()
    expect(spy).not.toHaveBeenCalled()
  })

  it('skips while importRunning and re-detects when sources attach', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['a1'],
        assets: {
          a1: {
            contentHash:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: true,
      importExpectedCount: 1,
    })
    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'editor',
      bookId: 'book-1',
      restorePending: false,
      accessPhase: 'idle',
    })
    const spy = vi.spyOn(detect, 'detectMissingAssets')
    syncRelinkAutoDetect()
    expect(spy).not.toHaveBeenCalled()

    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['a1'],
        assets: {
          a1: {
            contentHash:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    retainAssetSource('a1', file)
    syncRelinkAutoDetect()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(getRelinkStatus('a1')).toBeUndefined()
  })

  it('installRelinkAutoDetect is idempotent and uninstalls', () => {
    vi.spyOn(projectSession, 'getProjectSessionSnapshot').mockReturnValue({
      ...projectSession.getProjectSessionSnapshot(),
      surface: 'editor',
      bookId: 'book-1',
      restorePending: false,
      accessPhase: 'idle',
    })
    const first = installRelinkAutoDetect()
    const second = installRelinkAutoDetect()
    expect(typeof second).toBe('function')
    second()
    first()
    // After uninstall, a fresh install may detect again with a new gallery key.
    resetRelinkAutoDetect()
    const again = installRelinkAutoDetect()
    again()
  })
})

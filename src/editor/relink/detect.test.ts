import { afterEach, describe, expect, it } from 'vitest'

import { retainAssetSource, resetAssetSources } from '../../photo/assetSources'
import {
  getBookStoreSnapshot,
  patchAssetRecord,
  resetBookStore,
} from '../bookStore'
import { detectMissingAssets } from './detect'
import {
  getRelinkStatus,
  isRelinkDialogOpen,
  resetRelinkStore,
} from './statusStore'

function seedBook(gallery: string[], assets: Record<string, object>): void {
  resetBookStore({
    book: {
      ...getBookStoreSnapshot().book,
      gallery,
      assets,
    },
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('detectMissingAssets', () => {
  afterEach(() => {
    resetRelinkStore()
    resetAssetSources()
    resetBookStore()
  })

  it('marks identity assets without a live File as missing and opens dialog', () => {
    seedBook(['asset-1'], {
      'asset-1': {
        contentHash:
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        relativePath: 'a.jpg',
        sourceRootId: 'root',
      },
    })

    const result = detectMissingAssets()

    expect(result.missing).toBe(1)
    expect(getRelinkStatus('asset-1')).toBe('missing')
    expect(isRelinkDialogOpen()).toBe(true)
  })

  it('skips assets that still have a live File', () => {
    seedBook(['asset-live'], {
      'asset-live': {
        contentHash:
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        relativePath: 'a.jpg',
        sourceRootId: 'root',
      },
    })
    retainAssetSource(
      'asset-live',
      new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
    )

    const result = detectMissingAssets()

    expect(result.missing).toBe(0)
    expect(getRelinkStatus('asset-live')).toBeUndefined()
    expect(isRelinkDialogOpen()).toBe(false)
  })

  it('ignores gallery assets without identity', () => {
    seedBook(['session-only'], { 'session-only': {} })
    expect(detectMissingAssets().missing).toBe(0)
  })

  it('treats relativePath-only and sourceRootId-only as identity', () => {
    seedBook(['by-path', 'by-root'], {
      'by-path': { relativePath: 'a.jpg' },
      'by-root': { sourceRootId: 'root-1' },
    })
    expect(detectMissingAssets({ openDialog: false }).missing).toBe(2)
    expect(getRelinkStatus('by-path')).toBe('missing')
    expect(getRelinkStatus('by-root')).toBe('missing')
  })

  it('can detect without opening the dialog', () => {
    seedBook(['asset-1'], {
      'asset-1': {
        contentHash:
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    })

    detectMissingAssets({ openDialog: false })
    expect(isRelinkDialogOpen()).toBe(false)
    expect(getRelinkStatus('asset-1')).toBe('missing')
  })

  it('patchAssetRecord keeps identity for detect', () => {
    seedBook(['asset-1'], { 'asset-1': {} })
    patchAssetRecord('asset-1', {
      contentHash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    })
    expect(detectMissingAssets({ openDialog: false }).missing).toBe(1)
  })

  it('skips assets missing from the assets map', () => {
    seedBook(['ghost'], {})
    expect(detectMissingAssets({ openDialog: false }).missing).toBe(0)
  })

  it('does not mark missing while import is running', () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['asset-1'],
        assets: {
          'asset-1': {
            contentHash:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: true,
      importExpectedCount: 1,
    })
    expect(detectMissingAssets({ openDialog: false }).missing).toBe(0)
    expect(getRelinkStatus('asset-1')).toBeUndefined()
  })
})

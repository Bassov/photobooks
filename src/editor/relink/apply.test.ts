import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAssetSource, resetAssetSources } from '../../photo/assetSources'
import { getBookStoreSnapshot, resetBookStore } from '../bookStore'
import * as projectSession from '../projectSession'
import { applyRelinkEntries, mergeMatchStatuses } from './apply'
import {
  getRelinkStatus,
  replaceRelinkStatuses,
  resetRelinkStore,
} from './statusStore'

describe('applyRelinkEntries', () => {
  afterEach(() => {
    resetRelinkStore()
    resetAssetSources()
    resetBookStore()
    vi.restoreAllMocks()
  })

  it('is a no-op for an empty entry list', async () => {
    const register = vi.spyOn(projectSession, 'registerAssetSource')
    await applyRelinkEntries([], { sourceRootId: 'root' })
    expect(register).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.gallery).toEqual([])
  })

  it('patches identity, retains the File, and marks ok', async () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['a1'],
        assets: { a1: { contentHash: 'ab'.repeat(32) } },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    const file = new File([new Uint8Array([9])], 'n.jpg', {
      type: 'image/jpeg',
      lastModified: 42,
    })
    const register = vi.spyOn(projectSession, 'registerAssetSource')

    await applyRelinkEntries(
      [
        {
          assetId: 'a1',
          entry: {
            relativePath: 'moved/n.jpg',
            byteSize: 1,
            mtimeMs: 42,
            contentHash: 'a'.repeat(64),
          },
          file,
        },
      ],
      { sourceRootId: 'root-new' },
    )

    expect(register).toHaveBeenCalledWith('root-new', expect.anything())
    expect(getAssetSource('a1')).toBe(file)
    expect(getBookStoreSnapshot().book.assets.a1?.relativePath).toBe(
      'moved/n.jpg',
    )
    expect(getBookStoreSnapshot().book.assets.a1?.sourceRootId).toBe('root-new')
    expect(getBookStoreSnapshot().book.assets.a1?.byteSize).toBe(1)
    expect(getBookStoreSnapshot().book.assets.a1?.mtimeMs).toBe(42)
    expect(getBookStoreSnapshot().book.assets.a1?.contentHash).toBe(
      'a'.repeat(64),
    )
    expect(getRelinkStatus('a1')).toBe('ok')
  })

  it('omits contentHash patch when the entry has none', async () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['a1'],
        assets: { a1: { contentHash: 'ab'.repeat(32) } },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const file = new File([new Uint8Array([9])], 'n.jpg', {
      type: 'image/jpeg',
      lastModified: 42,
    })
    await applyRelinkEntries(
      [
        {
          assetId: 'a1',
          entry: {
            relativePath: 'moved/n.jpg',
            byteSize: 1,
            mtimeMs: 42,
          },
          file,
        },
      ],
      { sourceRootId: 'root-new' },
    )
    expect(getBookStoreSnapshot().book.assets.a1?.contentHash).toBe(
      'ab'.repeat(32),
    )
  })

  it('mergeMatchStatuses drops ok and keeps problems', () => {
    replaceRelinkStatuses(new Map([['keep', 'missing']]))
    mergeMatchStatuses(
      new Map([
        ['keep', 'ok'],
        ['mod', 'modified'],
      ]),
    )
    expect(getRelinkStatus('keep')).toBeUndefined()
    expect(getRelinkStatus('mod')).toBe('modified')
  })
})

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import type { FolderImportBatchOptions } from './photoRootSession'
import {
  PHOTO_FOLDER_NOT_REMEMBERED_STATUS,
  useChromeImport,
} from './useChromeImport'

const io = vi.hoisted(() => ({
  persist: vi.fn<() => Promise<boolean>>(),
  importBatches:
    vi.fn<
      (
        dir: unknown,
        entries: unknown,
        o: FolderImportBatchOptions,
      ) => Promise<unknown>
    >(),
}))

vi.mock('../assets', async (original) => ({
  ...(await original<typeof import('../assets')>()),
  createFsaAssetSource: () => ({
    scanRoot: () =>
      Promise.resolve({
        ok: true,
        value: [{ relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 }],
      }),
  }),
}))

vi.mock('../project/session/sourceRootEntryIndex', () => ({
  persistScannedEntryIndex: () => Promise.resolve(),
}))

vi.mock('./photoRootSession', async (original) => ({
  ...(await original<typeof import('./photoRootSession')>()),
  bindPhotoFolder: () => Promise.resolve({ sourceRootId: 'root-test' }),
  persistBoundPhotoFolder: io.persist,
  registerBoundPhotoFolderSource: () => undefined,
  importScannedEntriesInBatches: io.importBatches,
}))

const directory = {
  kind: 'directory',
  name: 'trip',
} as FileSystemDirectoryHandle

function mount() {
  const onImportProgress = vi.fn()
  const hook = renderHook(() => useChromeImport({ onImportProgress }))
  return { hook, onImportProgress }
}

afterEach(() => {
  cleanup()
  io.persist.mockReset()
  io.importBatches.mockReset()
  resetBookStore()
  setEditorStatus('')
})

describe('useChromeImport folder persist', () => {
  it('says the folder will not survive reload when persist fails, persisting once', async () => {
    io.persist.mockResolvedValue(false)
    io.importBatches.mockImplementation(async (_dir, _entries, options) => {
      await options.onFirstBatchYielded?.()
      return { imported: 1, skipped: 0, errors: [] }
    })
    const { hook } = mount()

    await act(async () => {
      await hook.result.current.onDropPhotoFolder(directory)
    })

    expect(io.persist).toHaveBeenCalledOnce()
    expect(getEditorStatus()).toBe(PHOTO_FOLDER_NOT_REMEMBERED_STATUS)
  })

  it('persists after import when no batch yielded and keeps the hint on success', async () => {
    io.persist.mockResolvedValue(true)
    io.importBatches.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    const { hook } = mount()

    await act(async () => {
      await hook.result.current.onDropPhotoFolder(directory)
    })

    expect(io.persist).toHaveBeenCalledOnce()
    expect(getEditorStatus()).not.toBe(PHOTO_FOLDER_NOT_REMEMBERED_STATUS)
  })

  it('clears progress and importRunning when a first-folder import aborts', async () => {
    io.persist.mockResolvedValue(true)
    const failure = new Error('import aborted')
    io.importBatches.mockRejectedValue(failure)
    const { hook, onImportProgress } = mount()

    await act(async () => {
      await expect(
        hook.result.current.onDropPhotoFolder(directory),
      ).rejects.toBe(failure)
    })

    expect(onImportProgress).toHaveBeenLastCalledWith(null)
    expect(getBookStoreSnapshot().importRunning).toBe(false)
  })
})

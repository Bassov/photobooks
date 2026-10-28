import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { useChromeImport } from './useChromeImport'

const hasPhotoFolder = vi.hoisted(() => ({
  value: false,
  bound: undefined as object | undefined,
}))

vi.mock('../assets', async (original) => ({
  ...(await original<typeof import('../assets')>()),
  createFsaAssetSource: () => ({
    scanRoot: () => Promise.resolve({ ok: false }),
  }),
}))

vi.mock('./photoRootSession', async (original) => {
  const real = await original<typeof import('./photoRootSession')>()
  return {
    ...real,
    getPhotoRootSessionSnapshot: () =>
      hasPhotoFolder.value
        ? (hasPhotoFolder.bound ??= {
            ...real.getPhotoRootSessionSnapshot(),
            hasPhotoFolder: true,
          })
        : real.getPhotoRootSessionSnapshot(),
    bindPhotoFolder: () => Promise.resolve({ sourceRootId: 'root-test' }),
    persistBoundPhotoFolder: () => Promise.resolve(),
    registerBoundPhotoFolderSource: () => undefined,
    clearBoundPhotoFolderForReplace: () => Promise.resolve(),
  }
})

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
  hasPhotoFolder.value = false
  setEditorStatus('')
  vi.unstubAllGlobals()
})

describe('useChromeImport.onDropPhotoFolder', () => {
  it('imports a dropped folder through the folder import path', async () => {
    const { hook, onImportProgress } = mount()
    await act(async () => {
      await hook.result.current.onDropPhotoFolder(directory)
    })
    expect(onImportProgress).toHaveBeenCalledWith(
      expect.objectContaining({ running: true }),
    )
    expect(getEditorStatus()).toBe('Could not read photo folder')
  })

  it('asks before replacing a bound folder and stops on cancel', async () => {
    hasPhotoFolder.value = true
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const { hook, onImportProgress } = mount()
    await act(async () => {
      await hook.result.current.onDropPhotoFolder(directory)
    })
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(onImportProgress).not.toHaveBeenCalled()
  })

  it('replaces the bound folder after the user confirms', async () => {
    hasPhotoFolder.value = true
    vi.stubGlobal('confirm', () => true)
    const { hook, onImportProgress } = mount()
    await act(async () => {
      await hook.result.current.onDropPhotoFolder(directory)
    })
    expect(onImportProgress).toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  bindFolderInput,
  clickFolderInput,
  folderInputChanged,
  resolveAndMaybeClose,
  skipRelinkDialog,
} from './dialogActions'
import {
  isRelinkDialogOpen,
  resetRelinkStore,
  setRelinkDialogOpen,
} from './statusStore'

describe('dialogActions', () => {
  afterEach(() => {
    resetRelinkStore()
  })

  it('skipRelinkDialog closes', () => {
    setRelinkDialogOpen(true)
    skipRelinkDialog()
    expect(isRelinkDialogOpen()).toBe(false)
  })

  it('clickFolderInput no-ops on null and clicks otherwise', () => {
    clickFolderInput(null)
    const click = vi.fn()
    clickFolderInput({ click } as unknown as HTMLInputElement)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('bindFolderInput stores ref and sets webkitdirectory', () => {
    const ref = { current: null as HTMLInputElement | null }
    const setAttribute = vi.fn()
    const el = { setAttribute } as unknown as HTMLInputElement
    bindFolderInput(el, ref)
    expect(ref.current).toBe(el)
    expect(setAttribute).toHaveBeenCalledWith('webkitdirectory', '')
    bindFolderInput(null, ref)
    expect(ref.current).toBeNull()
  })

  it('resolveAndMaybeClose closes only on positive count', async () => {
    setRelinkDialogOpen(true)
    await resolveAndMaybeClose(() => Promise.resolve(0))
    expect(isRelinkDialogOpen()).toBe(true)
    await resolveAndMaybeClose(() => Promise.resolve(2))
    expect(isRelinkDialogOpen()).toBe(false)
  })

  it('folderInputChanged ignores empty and rescans otherwise', async () => {
    const onRescan = vi.fn((): Promise<undefined> => Promise.resolve(undefined))
    const clear = vi.fn()
    folderInputChanged(null, onRescan, clear)
    expect(clear).toHaveBeenCalled()
    expect(onRescan).not.toHaveBeenCalled()

    const file = new File([new Uint8Array([1])], 'a.jpg')
    const list = {
      0: file,
      length: 1,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file
      },
    } as unknown as FileList
    folderInputChanged(list, onRescan, clear)
    await vi.waitFor(() => {
      expect(onRescan).toHaveBeenCalledWith([file])
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isCoverSelected,
  setCoverSelected,
  subscribeCoverSelection,
} from './coverSelection'
import { setActiveSpreadId } from './photoRootSession'
import { resetFrameSelection, setFrameSource } from './frameSelection'

describe('coverSelection', () => {
  afterEach(() => {
    setCoverSelected(false)
    setActiveSpreadId(null)
    resetFrameSelection()
  })

  it('starts unselected and notifies only on change', () => {
    const listener = vi.fn()
    const stop = subscribeCoverSelection(listener)
    expect(isCoverSelected()).toBe(false)
    setCoverSelected(false)
    expect(listener).not.toHaveBeenCalled()
    setCoverSelected(true)
    setCoverSelected(true)
    expect(isCoverSelected()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    setCoverSelected(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('picking another spread leaves the cover', () => {
    setCoverSelected(true)
    setActiveSpreadId('s-other')
    expect(isCoverSelected()).toBe(false)
  })

  it('selecting a frame leaves the cover; clearing the source keeps it', () => {
    setCoverSelected(true)
    setFrameSource(null)
    expect(isCoverSelected()).toBe(true)
    setFrameSource({ spreadId: 's1', frameId: 'f1' })
    expect(isCoverSelected()).toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getLeftPanelTab,
  resetLeftPanelTabForTests,
  setLeftPanelTab,
  subscribeLeftPanelTab,
} from './leftPanelTabStore'

describe('leftPanelTabStore', () => {
  afterEach(resetLeftPanelTabForTests)

  it('starts on pages, notifies on change only, and unsubscribes', () => {
    const listener = vi.fn()
    const off = subscribeLeftPanelTab(listener)
    expect(getLeftPanelTab()).toBe('pages')
    setLeftPanelTab('pages')
    expect(listener).not.toHaveBeenCalled()
    setLeftPanelTab('masters')
    expect(getLeftPanelTab()).toBe('masters')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setLeftPanelTab('pages')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('resets to pages', () => {
    setLeftPanelTab('masters')
    resetLeftPanelTabForTests()
    expect(getLeftPanelTab()).toBe('pages')
  })
})

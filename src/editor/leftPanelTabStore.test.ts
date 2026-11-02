import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getLeftPanelTab,
  getPickedParentId,
  resetLeftPanelTabForTests,
  setLeftPanelTab,
  setPickedParentId,
  shownParentId,
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
    setPickedParentId('p1')
    resetLeftPanelTabForTests()
    expect(getLeftPanelTab()).toBe('pages')
    expect(getPickedParentId()).toBeNull()
  })

  it('notifies a parent pick on change only', () => {
    const listener = vi.fn()
    const off = subscribeLeftPanelTab(listener)

    setPickedParentId('p1')
    setPickedParentId('p1')
    off()

    expect(getPickedParentId()).toBe('p1')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the picked parent', [{ id: 'a' }, { id: 'b' }], 'b', 'b'],
    ['the first when the pick is gone', [{ id: 'a' }, { id: 'b' }], 'x', 'a'],
    ['the first without a pick', [{ id: 'a' }], null, 'a'],
    ['none without parents', [], 'a', null],
    ['none for a book without the field', undefined, null, null],
  ])('shows %s', (_, parents, picked, shown) => {
    expect(shownParentId(parents, picked)).toBe(shown)
  })
})

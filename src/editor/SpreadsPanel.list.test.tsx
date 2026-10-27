import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addSpread } from '../core'
import { makeBook } from '../core/testing/fixtures'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import { getSpreadIdsSnapshot, resetBookStore } from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'
import { SpreadsPanel } from './SpreadsPanel'
import { SPREADS_ROW_PX, SPREADS_THUMB_HEIGHT_PX } from './spreadsPanelModel'

function seedSpreads(count: number): void {
  let book = makeBook({ id: 'many', spreads: [] })
  for (let i = 0; i < count; i += 1) {
    book = addSpread(book, { id: `s${String(i)}` })
  }
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const renderedIds = (): string[] =>
  screen
    .queryAllByRole('option')
    .map((node) => node.getAttribute('data-item') ?? '')

function stubViewport(height: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
}

function fakeQueue(add: ReturnType<typeof vi.fn>): PhotobooksToastQueue {
  return { add } as unknown as PhotobooksToastQueue
}

describe('SpreadsPanel list', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetActiveSpreadIdForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('windows a long list and moves the window on scroll', () => {
    seedSpreads(200)
    stubViewport(300)
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    const first = renderedIds()
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThan(15)
    expect(first[0]).toBe('s0')

    const far = 100 * SPREADS_ROW_PX
    list.scrollTop = far
    fireEvent.scroll(list)
    const moved = renderedIds()
    expect(moved).not.toContain('s0')
    expect(moved).toContain('s100')
    expect(moved.length).toBeLessThan(15)
    const start = Number(moved[0]?.slice(1))
    expect(screen.getByTestId('spreads-lead').style.height).toBe(
      `${String(start * SPREADS_ROW_PX)}px`,
    )
    expect(screen.getByTestId('spreads-tail').style.height).toBe(
      `${String((200 - start - moved.length) * SPREADS_ROW_PX)}px`,
    )
    const row = screen.getByTestId('spread-list-item-s100')
    expect(row.parentElement?.style.height).toBe(`${String(SPREADS_ROW_PX)}px`)
    expect(row.querySelector('[data-label]')?.textContent).toBe('200–201')
    expect(row.getAttribute('data-first')).toBe('false')

    // Scrolling within the same window keeps the exact same rows.
    list.scrollTop = far + 1
    fireEvent.scroll(list)
    expect(renderedIds()).toEqual(moved)
  })

  it('re-measures when the list is resized and disconnects on unmount', () => {
    seedSpreads(200)
    let height = SPREADS_ROW_PX
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
      () => height,
    )
    const observers: ResizeObserverCallback[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          observers.push(cb)
        }
        observe(): void {
          return undefined
        }
        disconnect = disconnect
      },
    )
    const view = render(<SpreadsPanel />)
    const small = renderedIds().length
    height = 10 * SPREADS_ROW_PX
    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(renderedIds().length).toBeGreaterThan(small)
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('scrolls the list to reveal the active row, only when needed', () => {
    seedSpreads(50)
    stubViewport(300)
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    act(() => {
      setActiveSpreadId('s1')
    })
    expect(list.scrollTop).toBe(0)
    act(() => {
      setActiveSpreadId('s30')
    })
    expect(list.scrollTop).toBe(31 * SPREADS_ROW_PX - 300)
    act(() => {
      setActiveSpreadId('s5')
    })
    expect(list.scrollTop).toBe(5 * SPREADS_ROW_PX)
    act(() => {
      setActiveSpreadId('s0')
    })
    expect(list.scrollTop).toBe(0)
  })

  it('acts on the focused row, not on a stale selection', () => {
    seedSpreads(4)
    setActiveSpreadId('s0')
    render(<SpreadsPanel />)
    fireEvent.keyDown(screen.getByTestId('spread-list-item-s2'), {
      key: 'd',
      ctrlKey: true,
    })
    expect(getSpreadIdsSnapshot().slice(0, 4)).toEqual(
      expect.arrayContaining(['s0', 's1', 's2']),
    )
    expect(getSpreadIdsSnapshot()).toHaveLength(5)
    expect(getSpreadIdsSnapshot()[2]).toBe('s2')
    expect(getActiveSpreadId()).toBe(getSpreadIdsSnapshot()[3])
  })

  it('exposes roving tabindex, selection and the thumb height variable', () => {
    seedSpreads(3)
    setActiveSpreadId('s1')
    render(<SpreadsPanel />)
    expect(
      screen
        .getByTestId('spreads-panel')
        .style.getPropertyValue('--spreads-thumb-h'),
    ).toBe(`${String(SPREADS_THUMB_HEIGHT_PX)}px`)
    const rows = ['s0', 's1', 's2'].map((id) =>
      screen.getByTestId(`spread-list-item-${id}`),
    )
    expect(rows.map((row) => row.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ])
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('moves selection and focus with the arrow keys, stopping at the ends', () => {
    seedSpreads(3)
    render(<SpreadsPanel />)
    const row = (id: string) => screen.getByTestId(`spread-list-item-${id}`)
    fireEvent.keyDown(row('s0'), { key: 'ArrowUp' })
    expect(getActiveSpreadId()).toBeNull()
    fireEvent.keyDown(row('s0'), { key: 'ArrowDown' })
    expect(getActiveSpreadId()).toBe('s1')
    expect(document.activeElement).toBe(row('s1'))
    fireEvent.keyDown(row('s1'), { key: 'ArrowDown' })
    fireEvent.keyDown(row('s2'), { key: 'ArrowDown' })
    expect(getActiveSpreadId()).toBe('s2')
    fireEvent.keyDown(row('s2'), { key: 'ArrowUp' })
    expect(getActiveSpreadId()).toBe('s1')
  })

  it('ignores shortcuts that do not come from a row', () => {
    seedSpreads(3)
    render(<SpreadsPanel />)
    fireEvent.keyDown(screen.getByTestId('spreads-list'), {
      key: 'd',
      ctrlKey: true,
    })
    fireEvent.keyDown(screen.getByTestId('spread-menu-s1'), { key: 'Delete' })
    fireEvent.keyDown(screen.getByTestId('spread-list-item-s0'), { key: 'x' })
    expect(getSpreadIdsSnapshot()).toEqual(['s0', 's1', 's2'])
  })

  it('offers add after, duplicate and delete in the row menu', async () => {
    seedSpreads(3)
    stubViewport(10 * SPREADS_ROW_PX)
    render(<SpreadsPanel />)

    fireEvent.click(screen.getByTestId('spread-menu-s1'))
    fireEvent.click(await screen.findByTestId('spread-menu-add'))
    expect(getSpreadIdsSnapshot()).toHaveLength(4)
    expect(getSpreadIdsSnapshot()[1]).toBe('s1')
    expect(getActiveSpreadId()).toBe(getSpreadIdsSnapshot()[2])

    fireEvent.click(screen.getByTestId('spread-menu-s0'))
    fireEvent.click(await screen.findByTestId('spread-menu-duplicate'))
    expect(getSpreadIdsSnapshot()).toHaveLength(5)
    expect(getSpreadIdsSnapshot()[0]).toBe('s0')
    expect(getActiveSpreadId()).toBe(getSpreadIdsSnapshot()[1])

    fireEvent.click(screen.getByTestId('spread-menu-s2'))
    fireEvent.click(await screen.findByTestId('spread-menu-delete'))
    expect(getSpreadIdsSnapshot()).not.toContain('s2')
    expect(getSpreadIdsSnapshot()).toHaveLength(4)
  })

  it('disables Delete in the menu for the last spread', async () => {
    seedSpreads(1)
    render(<SpreadsPanel />)
    fireEvent.click(screen.getByTestId('spread-menu-s0'))
    const del = await screen.findByTestId('spread-menu-delete')
    expect(del.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(del)
    expect(getSpreadIdsSnapshot()).toEqual(['s0'])
  })

  it('shows an Undo toast on delete and Undo restores the spread', () => {
    seedSpreads(3)
    setActiveSpreadId('s1')
    const add = vi.fn()
    render(<SpreadsPanel toastQueue={fakeQueue(add)} />)
    fireEvent.keyDown(screen.getByTestId('spread-list-item-s1'), {
      key: 'Delete',
    })
    expect(getSpreadIdsSnapshot()).toEqual(['s0', 's2'])
    expect(getActiveSpreadId()).toBe('s2')
    expect(add).toHaveBeenCalledTimes(1)
    const [content, options] = add.mock.calls[0] as [
      {
        title: string
        testId: string
        action: { label: string; onAction: () => void }
      },
      unknown,
    ]
    expect(content).toMatchObject({
      title: 'Spread deleted',
      testId: 'spread-deleted-toast',
      action: { label: 'Undo' },
    })
    expect(options).toEqual({ timeout: 6000 })
    act(() => {
      content.action.onAction()
    })
    expect(getSpreadIdsSnapshot()).toEqual(['s0', 's1', 's2'])
  })

  it('selects the previous spread after deleting the last one', () => {
    seedSpreads(3)
    setActiveSpreadId('s2')
    render(<SpreadsPanel />)
    fireEvent.keyDown(screen.getByTestId('spread-list-item-s2'), {
      key: 'Delete',
    })
    expect(getActiveSpreadId()).toBe('s1')
  })

  it('does not toast or delete the last spread', () => {
    seedSpreads(1)
    const add = vi.fn()
    render(<SpreadsPanel toastQueue={fakeQueue(add)} />)
    fireEvent.keyDown(screen.getByTestId('spread-list-item-s0'), {
      key: 'Delete',
    })
    expect(add).not.toHaveBeenCalled()
    expect(getSpreadIdsSnapshot()).toEqual(['s0'])
  })

  it('appends from the footer button without changing the selection', () => {
    seedSpreads(2)
    render(<SpreadsPanel />)
    fireEvent.click(screen.getByTestId('add-spread'))
    expect(getSpreadIdsSnapshot()).toHaveLength(3)
    expect(getActiveSpreadId()).toBeNull()
  })
})

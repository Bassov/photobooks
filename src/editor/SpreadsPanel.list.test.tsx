import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addSpread } from '../core'
import { makeBook } from '../core/testing/fixtures'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import {
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  getSpreadPaintSnapshot,
  resetBookStore,
} from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'
import { SpreadsPanel } from './SpreadsPanel'
import { spreadsRowPx as rowPx } from './spreadsPanel.test-helpers'
import { spreadsRowGeometry } from './spreadsPanelModel'

function seedSpreads(count: number, trimWidthMm = 300): void {
  let book = makeBook({
    id: 'many',
    spreads: [],
    settings: { trim: { widthMm: trimWidthMm, heightMm: 300 } },
  })
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

    const far = 100 * rowPx()
    list.scrollTop = far
    fireEvent.scroll(list)
    const moved = renderedIds()
    expect(moved).not.toContain('s0')
    expect(moved).toContain('s100')
    expect(moved.length).toBeLessThan(15)
    const start = Number(moved[0]?.slice(1))
    expect(
      Number.parseFloat(screen.getByTestId('spreads-lead').style.height),
    ).toBeCloseTo(start * rowPx(), 1)
    expect(
      Number.parseFloat(screen.getByTestId('spreads-tail').style.height),
    ).toBeCloseTo((200 - start - moved.length) * rowPx(), 1)
    const row = screen.getByTestId('spread-list-item-s100')
    expect(
      Number.parseFloat(row.parentElement?.style.height ?? ''),
    ).toBeCloseTo(rowPx(), 2)
    expect(row.querySelector('[data-label]')?.textContent).toBe('200–201')
    expect(row.getAttribute('data-first')).toBe('false')

    // Scrolling within the same window keeps the exact same rows.
    list.scrollTop = far + 1
    fireEvent.scroll(list)
    expect(renderedIds()).toEqual(moved)
  })

  it('re-measures when the list is resized and disconnects on unmount', () => {
    seedSpreads(200)
    let height = rowPx()
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
    height = 10 * rowPx()
    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(renderedIds().length).toBeGreaterThan(small)
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('scrolls the list to reveal the active row, only when needed', () => {
    seedSpreads(50)
    stubViewport(400)
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    act(() => {
      setActiveSpreadId('s1')
    })
    expect(list.scrollTop).toBe(0)
    act(() => {
      setActiveSpreadId('s30')
    })
    expect(list.scrollTop).toBeCloseTo(31 * rowPx() - 400, 3)
    act(() => {
      setActiveSpreadId('s5')
    })
    expect(list.scrollTop).toBeCloseTo(5 * rowPx(), 3)
    act(() => {
      setActiveSpreadId('s0')
    })
    expect(list.scrollTop).toBe(0)
  })

  it('sizes each thumb from the measured list width and the spread aspect', () => {
    seedSpreads(2)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(220)
    render(<SpreadsPanel />)
    const box = document.querySelector<HTMLElement>('.editor-spread-thumb')
    const view = document.querySelector<HTMLElement>('.spread-view--thumb')
    const pageAspect =
      Number.parseFloat(view?.style.width ?? '') /
      Number.parseFloat(view?.style.height ?? '')
    // Page 1 sits on the right half of a spread-wide slot (M45).
    const slotAspect = 2 * pageAspect
    // 220 - list inset 16 - row padding 16.
    const geometry = spreadsRowGeometry(220, slotAspect)
    expect(Number.parseFloat(view?.style.width ?? '')).toBeCloseTo(
      geometry.thumbWidthPx / 2,
      3,
    )
    expect(Number.parseFloat(box?.style.height ?? '')).toBeCloseTo(
      188 / Math.max(slotAspect, 1.6),
      3,
    )
    const row = screen.getByTestId('spread-list-item-s0').parentElement
    expect(Number.parseFloat(row?.style.height ?? '')).toBeCloseTo(
      geometry.rowPx,
      3,
    )
  })

  it('puts single pages on their side and page 1’s label under its half (M45)', () => {
    seedSpreads(3)
    render(<SpreadsPanel />)
    const rows = ['s0', 's1', 's2'].map((id) =>
      screen.getByTestId(`spread-list-item-${id}`),
    )
    expect(rows.map((row) => row.dataset.pageSide)).toEqual([
      'right',
      undefined,
      'left',
    ])
    expect(
      rows.map(
        (row) =>
          row.querySelector<HTMLElement>('[data-label]')?.parentElement?.style
            .paddingLeft,
      ),
    ).toEqual(['50%', '', ''])
    expect(
      rows.map((row) => row.querySelector('[data-label]')?.textContent),
    ).toEqual(['1', '2–3', '4'])
  })

  it('re-derives the row height when the spread aspect changes', () => {
    seedSpreads(2)
    render(<SpreadsPanel />)
    const rowHeight = (): number =>
      Number.parseFloat(
        screen.getByTestId('spread-list-item-s0').parentElement?.style.height ??
          '',
      )
    const square = rowHeight()
    act(() => {
      seedSpreads(2, 1000)
    })
    // A much wider page makes a wider spread → a shorter thumb box.
    expect(rowHeight()).toBeLessThan(square)
  })

  it('re-derives the row height when only the trim changes, keeping the same spreads', () => {
    seedSpreads(2)
    render(<SpreadsPanel />)
    const rowHeight = (): number =>
      Number.parseFloat(
        screen.getByTestId('spread-list-item-s0').parentElement?.style.height ??
          '',
      )
    const square = rowHeight()
    const { book } = getBookStoreSnapshot()
    act(() => {
      resetBookStore({
        book: {
          ...book,
          settings: {
            ...book.settings,
            trim: { widthMm: 1000, heightMm: 300 },
          },
        },
        sessionMeta: new Map(),
        previewUrls: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(rowHeight()).toBeLessThan(square)
  })

  it('sizes the row from the first spread aspect, not the 2:1 default', () => {
    seedSpreads(2, 1000)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(220)
    render(<SpreadsPanel />)
    const resolved = getSpreadPaintSnapshot('s0')?.resolved
    // Page 1 keeps a spread-wide slot (M45): twice the page aspect.
    const aspect =
      (2 * (resolved?.spreadWidthMm ?? 1)) / (resolved?.spreadHeightMm ?? 1)
    expect(aspect).toBeGreaterThan(5)
    const row = screen.getByTestId('spread-list-item-s0').parentElement
    expect(Number.parseFloat(row?.style.height ?? '')).toBeCloseTo(
      spreadsRowGeometry(220, aspect).rowPx,
      3,
    )
  })

  it('renders the rows on the server snapshot', () => {
    seedSpreads(2)
    const html = renderToString(<SpreadsPanel />)
    expect(html).toContain('data-item="s0"')
    expect(html).toContain('data-item="s1"')
  })

  it('reveals the row an Alt+Arrow move lands on', () => {
    seedSpreads(50)
    stubViewport(300)
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    const to = Math.floor(300 / rowPx()) + 1
    const from = screen.getByTestId(`spread-list-item-s${String(to - 1)}`)
    expect(list.scrollTop).toBe(0)
    fireEvent.keyDown(from, { key: 'ArrowDown', altKey: true })
    expect(getSpreadIdsSnapshot()[to]).toBe(`s${String(to - 1)}`)
    expect(list.scrollTop).toBeCloseTo((to + 1) * rowPx() - 300, 3)
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

  it('exposes roving tabindex and selection', () => {
    seedSpreads(3)
    setActiveSpreadId('s1')
    render(<SpreadsPanel />)
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

  it('keeps a tab stop on the first mounted row when the selection is windowed out', () => {
    seedSpreads(200)
    stubViewport(300)
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    list.scrollTop = 100 * rowPx()
    fireEvent.scroll(list)
    const ids = renderedIds()
    expect(ids).not.toContain('s0')
    const stops = screen
      .getAllByRole('option')
      .filter((row) => row.getAttribute('tabindex') === '0')
    expect(stops.map((row) => row.getAttribute('data-item'))).toEqual([ids[0]])
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
    stubViewport(10 * rowPx())
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

  it('names the trigger by pages and shows only bound key hints with a separator before Delete', async () => {
    seedSpreads(3)
    stubViewport(10 * rowPx())
    render(<SpreadsPanel />)

    const trigger = screen.getByTestId('spread-menu-s1')
    expect(trigger.getAttribute('aria-label')).toBe('Pages 2–3 actions')
    fireEvent.click(trigger)
    const add = await screen.findByTestId('spread-menu-add')
    expect(add.textContent).toContain('Ctrl+↵')
    expect(screen.getByTestId('spread-menu-duplicate').textContent).toContain(
      'Ctrl+D',
    )
    const del = screen.getByTestId('spread-menu-delete')
    expect(del.textContent).toContain('Del')
    const separator = screen.getByRole('separator')
    expect(
      separator.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      separator.compareDocumentPosition(
        screen.getByTestId('spread-menu-duplicate'),
      ) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
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

  it('has no footer Add spread button; the row menu adds after', async () => {
    seedSpreads(2)
    render(<SpreadsPanel />)
    expect(screen.queryByTestId('add-spread')).toBeNull()
    fireEvent.click(screen.getByTestId('spread-menu-s1'))
    fireEvent.click(await screen.findByTestId('spread-menu-add'))
    expect(getSpreadIdsSnapshot()).toHaveLength(3)
    expect(getSpreadIdsSnapshot().slice(0, 2)).toEqual(['s0', 's1'])
  })

  it('offsets the window and the reveal by the Cover / Endpaper head', () => {
    seedSpreads(200)
    stubViewport(300)
    const head = 2.5 * rowPx()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === 'cover-list' ? head : 0
      },
    )
    render(<SpreadsPanel />)
    const list = screen.getByTestId('spreads-list')
    list.scrollTop = head
    fireEvent.scroll(list)
    expect(renderedIds()[0]).toBe('s0')
    // Row 100 at the top: the window starts 3 overscan rows above it.
    list.scrollTop = head + 100 * rowPx()
    fireEvent.scroll(list)
    expect(renderedIds()[0]).toBe('s97')
    expect(renderedIds()).toContain('s100')
    act(() => {
      setActiveSpreadId('s150')
    })
    expect(list.scrollTop).toBeCloseTo(head + 151 * rowPx() - 300, 3)
  })
})

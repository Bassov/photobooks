import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Book, ParentSpread } from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'
import { MasterSection } from './MasterSection'

const MASTER_A: ParentSpread = {
  id: 'pa',
  name: 'Master A',
  frames: [],
  guides: [],
}

/** Three spreads (first page, a pair, last page); `uses` picks who takes Master A. */
function seed(
  parent: ParentSpread = MASTER_A,
  uses: readonly ('pa' | null)[] = [null, null, null],
) {
  const book: Book = makeBook({
    spreads: uses.map((parentId, i) =>
      makeSpread({ id: `s${String(i)}`, parentId }),
    ),
    parents: [parent, { ...MASTER_A, id: 'pb', name: 'Master B' }],
  })
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function input(field: string) {
  return screen.getByTestId<HTMLInputElement>(`master-field-${field}`)
}

function commit(field: string, value: string) {
  fireEvent.change(input(field), { target: { value } })
  fireEvent.blur(input(field))
}

function parentGrid() {
  return getBookStoreSnapshot().book.parents?.[0]?.layoutGrid
}

describe('MasterSection', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it.each([
    [[null, null, null], 'Not used yet'],
    [['pa', null, null], 'Used by 1 page'],
    [['pa', 'pa', null], 'Used by 3 pages'],
    [['pa', 'pa', 'pa'], 'Used by 4 pages'],
  ] as const)('head: %j → "%s"', (uses, text) => {
    seed(MASTER_A, uses)
    render(<MasterSection parentId="pa" />)
    expect(screen.getByTestId('inspector-context').textContent).toBe('Master A')
    expect(screen.getByTestId('master-usage').textContent).toBe(text)
  })

  it.each([
    [[undefined, undefined, undefined], 'Default · all 4 pages'],
    [[undefined, null, undefined], 'Default · 2 of 4 pages'],
    [[null, null, null], 'Default · no pages'],
  ] as const)('default head: %j → "%s", no Make default', (uses, text) => {
    resetBookStore({
      book: makeBook({
        spreads: uses.map((parentId, i) =>
          makeSpread({
            id: `s${String(i)}`,
            ...(parentId === undefined ? {} : { parentId }),
          }),
        ),
        parents: [MASTER_A],
        defaultParentId: 'pa',
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<MasterSection parentId="pa" />)
    expect(screen.getByTestId('master-usage').textContent).toBe(text)
    expect(screen.queryByTestId('master-make-default')).toBeNull()
    expect(screen.queryByTestId('master-hint')).toBeNull()
  })

  it('a master that is not the default offers Make default (and a hint while unused)', () => {
    seed(MASTER_A, [null, null, null])
    const { unmount } = render(<MasterSection parentId="pa" />)
    expect(screen.getByTestId('master-hint').textContent).toBe(
      'Pick it for a spread under Master & spacing, or make it the default.',
    )
    unmount()

    seed(MASTER_A, ['pa', null, null])
    render(<MasterSection parentId="pa" />)
    expect(screen.queryByTestId('master-hint')).toBeNull()
    fireEvent.click(screen.getByTestId('master-make-default'))
    expect(getBookStoreSnapshot().book.defaultParentId).toBe('pa')
    expect(screen.queryByTestId('master-make-default')).toBeNull()
    expect(screen.getByTestId('master-usage').textContent).toBe(
      'Default · 1 of 4 pages',
    )
  })

  it('renders nothing for an unknown parent or a book without parents', () => {
    seed()
    const { container, unmount } = render(<MasterSection parentId="nope" />)
    expect(container.innerHTML).toBe('')
    unmount()
    resetBookStore()
    expect(render(<MasterSection parentId="pa" />).container.innerHTML).toBe('')
  })

  it.each([
    ['bottom', { bottom: 9 }],
    ['inside', { inside: 9 }],
    ['outside', { outside: 9 }],
  ] as const)('the link starts off when %s differs', (_, margins) => {
    seed({ ...MASTER_A, layoutGrid: { margins } })
    render(<MasterSection parentId="pa" />)
    const link = screen.getByTestId('master-field-link')
    expect(link.getAttribute('aria-pressed')).toBe('false')
    expect(link.style.color.toUpperCase()).toBe(SUB)
    expect(link.style.background).toBe('')
  })

  it('counts step by 1 and clamp to 12; mm fields show the unit and no grouping', () => {
    seed()
    render(<MasterSection parentId="pa" />)
    commit('columns', '4.4')
    expect(parentGrid()?.columns).toBe(4)
    commit('rows', '30')
    expect(input('rows').value).toBe('12')
    commit('top', '1000')
    expect(input('top').value).toBe('1000')
    const box = (field: string) => input(field).parentElement
    expect(box('columns')?.textContent).toBe('C')
    expect(box('columnGutterMm')?.textContent).toBe('Gmm')
    const [label, , unit] = box('columnGutterMm')?.children ?? []
    const color = (el: Element | undefined) =>
      (el as HTMLElement | undefined)?.style.color.toUpperCase()
    expect(color(label)).toBe(SUB)
    expect(color(unit)).toBe(SUB)
    expect(color(input('columns'))).toBe(T)
    expect(color(screen.getByText('Margins'))).toBe(SUB)
    const link = screen.getByTestId('master-field-link')
    expect(link.style.background.toUpperCase()).toBe(FIELD)
    expect(color(link)).toBe(T)
  })

  it('lists the kit GRID fields with long names and effective values', () => {
    seed({ ...MASTER_A, layoutGrid: { columns: 4, margins: { top: 9 } } })
    render(<MasterSection parentId="pa" />)
    const names = [
      ['columns', 'Columns', '4'],
      ['rows', 'Rows', '2'],
      ['columnGutterMm', 'Gutter (mm)', '5'],
      ['rowGutterMm', 'Row gap (mm)', '5'],
      ['top', 'Top margin (mm)', '9'],
      ['bottom', 'Bottom margin (mm)', '15'],
      ['inside', 'Inside margin (mm)', '15'],
      ['outside', 'Outside margin (mm)', '15'],
    ] as const
    for (const [field, name, value] of names) {
      expect(input(field).getAttribute('aria-label')).toBe(name)
      expect(input(field).title).toBe(name)
      expect(input(field).value).toBe(value)
    }
    expect(screen.getByTestId('master-grid').textContent).toContain('Grid')
    // Unequal margins: the link starts off.
    const link = screen.getByTestId('master-field-link')
    expect(link.getAttribute('aria-pressed')).toBe('false')
    expect(link.querySelector('[data-icon="unlink2"]')).not.toBeNull()
  })

  it('a commit writes one setSpreadGrid on the parent: one history step', () => {
    seed()
    render(<MasterSection parentId="pa" />)
    const spreadsBefore = getBookStoreSnapshot().book.spreads
    commit('columns', '5')
    expect(parentGrid()).toEqual({ columns: 5 })
    expect(input('columns').value).toBe('5')
    expect(getBookStoreSnapshot().book.spreads).toBe(spreadsBefore)
    expect(getHistorySnapshot().canUndo).toBe(true)
    act(() => {
      undoBook()
    })
    expect(parentGrid()).toBeUndefined()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('an empty value reverts on blur and writes nothing', () => {
    seed()
    render(<MasterSection parentId="pa" />)
    const before = getBookStoreSnapshot().book
    commit('rows', '')
    expect(getBookStoreSnapshot().book).toBe(before)
    expect(input('rows').value).toBe('2')
  })

  it('linked (all margins equal): a margin edit writes all four in one step', () => {
    seed()
    render(<MasterSection parentId="pa" />)
    const link = screen.getByTestId('master-field-link')
    expect(link.getAttribute('aria-pressed')).toBe('true')
    expect(link.querySelector('[data-icon="link2"]')).not.toBeNull()
    commit('inside', '20')
    expect(parentGrid()).toEqual({
      margins: { top: 20, bottom: 20, inside: 20, outside: 20 },
    })
    for (const field of ['top', 'bottom', 'inside', 'outside']) {
      expect(input(field).value).toBe('20')
    }
    act(() => {
      undoBook()
    })
    expect(parentGrid()).toBeUndefined()
  })

  it('unlinked: one margin only; turning the link on writes T to B / I / O', () => {
    seed({ ...MASTER_A, layoutGrid: { margins: { top: 8, bottom: 12 } } })
    render(<MasterSection parentId="pa" />)
    commit('outside', '3')
    expect(parentGrid()?.margins).toEqual({ top: 8, bottom: 12, outside: 3 })
    fireEvent.click(screen.getByTestId('master-field-link'))
    expect(parentGrid()?.margins).toEqual({
      top: 8,
      bottom: 8,
      inside: 8,
      outside: 8,
    })
    expect(
      screen.getByTestId('master-field-link').getAttribute('aria-pressed'),
    ).toBe('true')
    act(() => {
      undoBook()
    })
    expect(parentGrid()?.margins).toEqual({ top: 8, bottom: 12, outside: 3 })
    // Turning it off writes nothing.
    const before = getBookStoreSnapshot().book
    fireEvent.click(screen.getByTestId('master-field-link'))
    expect(getBookStoreSnapshot().book).toBe(before)
  })
})

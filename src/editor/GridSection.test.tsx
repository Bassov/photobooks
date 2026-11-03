import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Book, Spread } from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { SUB } from './editorChromeTokens'
import { GridSection } from './GridSection'
import { getGridVisible, setGridVisible } from './gridView'

function load(book: Book) {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Two spreads using the book default parent "Master A" (book grid 2 × 2). */
function seed(spreadGrid?: Spread['layoutGrid']) {
  load(
    makeBook({
      spreads: [
        makeSpread({
          id: 's1',
          ...(spreadGrid === undefined ? {} : { layoutGrid: spreadGrid }),
        }),
        makeSpread({ id: 's2' }),
      ],
      parents: [{ id: 'pa', name: 'Master A', frames: [], guides: [] }],
      defaultParentId: 'pa',
    }),
  )
}

function input(name: string) {
  return screen.getByTestId<HTMLInputElement>(`spread-grid-field-${name}`)
}

/** The field box (`data-source`) around one input. */
function box(name: string) {
  const parent = input(name).parentElement
  if (parent === null) {
    throw new Error(`no field box for ${name}`)
  }
  return parent
}

function reset(name: string) {
  return screen.queryByTestId(`spread-grid-reset-${name}`)
}

/** A "Use master" / "Custom" choice of the spread Grid section. */
function source(name: string) {
  return within(
    screen.getByRole('radiogroup', { name: 'Grid source' }),
  ).getByRole<HTMLInputElement>('radio', { name })
}

function commit(name: string, value: string) {
  const target = input(name)
  fireEvent.change(target, { target: { value } })
  fireEvent.blur(target)
}

function spreadGrid() {
  return getBookStoreSnapshot().book.spreads[0]?.layoutGrid
}

function openCustom() {
  render(<GridSection spreadId="s1" />)
  fireEvent.click(source('Custom'))
}

describe('GridSection', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
    resetBookStore()
  })

  it('Use master shows the inherited summary; Custom shows grey fields and writes nothing', () => {
    seed()
    render(<GridSection spreadId="s1" />)
    expect(screen.getByText('Grid')).toBeTruthy()
    expect(source('Use master').checked).toBe(true)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toBe(
      'Master A · 2 × 2 · gutter 5 mm · margins 15/15/15/15 mm',
    )
    expect(screen.queryByTestId('spread-grid-field-columns')).toBeNull()
    const before = getBookStoreSnapshot().book
    fireEvent.click(source('Custom'))
    expect(source('Custom').checked).toBe(true)
    for (const name of ['columns', 'rows', 'columnGutterMm', 'top']) {
      expect(box(name).getAttribute('data-source')).toBe('book')
      expect(reset(name)).toBeNull()
    }
    expect(input('columns').value).toBe('2')
    const hint = screen.getByTestId('spread-grid-hint')
    expect(hint.textContent).toBe('Grey values follow Master A.')
    expect(hint.style.color).toBe(SUB)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('GP1: kit field order C R / G RG, Margins + link, T B / I O with short labels and mm', () => {
    seed()
    openCustom()
    const order = [
      ...screen
        .getByTestId('grid-section-spread')
        .querySelectorAll('[data-testid^="spread-grid-field-"]'),
    ].map((node) => node.getAttribute('data-testid'))
    expect(order).toEqual(
      [
        'columns',
        'rows',
        'columnGutterMm',
        'rowGutterMm',
        'top',
        'bottom',
        'inside',
        'outside',
      ].map((name) => `spread-grid-field-${name}`),
    )
    // Short label, unit, then the visually hidden source description.
    expect(box('rowGutterMm').textContent).toBe(
      'RGmmRow gap (mm) · from book grid',
    )
    expect(box('columns').textContent).toBe('CColumns · from book grid')
    expect(input('columnGutterMm').getAttribute('aria-label')).toBe(
      'Gutter (mm)',
    )
    expect(box('top').className).toContain('insp-grid-field')
  })

  it('GP2: an override reads source spread (title + description); the rest follow the parent', () => {
    seed()
    act(() => {
      dispatchBookOp({
        type: 'setSpreadGrid',
        spreadId: 'pa',
        patch: { columns: 5, columnGutterMm: 4 },
      })
    })
    openCustom()
    commit('rows', '3')
    expect(spreadGrid()).toEqual({ rows: 3 })
    expect(box('rows').getAttribute('data-source')).toBe('spread')
    expect(box('columns').getAttribute('data-source')).toBe('master')
    expect(box('top').getAttribute('data-source')).toBe('book')
    expect(input('rows').title).toBe('Rows · set on this spread')
    expect(input('columns').title).toBe('Columns · from Master A')
    expect(input('top').title).toBe('Top margin (mm) · from book grid')
    const describedBy = input('columnGutterMm').getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    const description = document.getElementById(
      String(describedBy?.split(' ')[0]),
    )
    expect(description?.textContent).toBe('Gutter (mm) · from Master A')
    expect(reset('rows')?.getAttribute('aria-label')).toBe(
      'Reset Rows to Master A',
    )
    expect(reset('columns')).toBeNull()
  })

  it('GP3: ↺ resets one field as one "Reset grid value" step and keeps Custom open', () => {
    seed({ columnGutterMm: 8, rows: 3 })
    render(<GridSection spreadId="s1" />)
    expect(source('Custom').checked).toBe(true)
    const gutter = screen.getByTestId('spread-grid-reset-columnGutterMm')
    expect(gutter.getAttribute('aria-label')).toBe('Reset Gutter to Master A')
    fireEvent.click(gutter)
    expect(spreadGrid()).toEqual({ rows: 3 })
    expect(getHistorySnapshot().undoLabel).toBe('Reset grid value')
    expect(box('columnGutterMm').getAttribute('data-source')).toBe('book')
    expect(input('columnGutterMm').value).toBe('5')
    // The last override: the spread grid is gone, Custom stays.
    fireEvent.click(screen.getByTestId('spread-grid-reset-rows'))
    expect(spreadGrid()).toBeUndefined()
    expect(source('Custom').checked).toBe(true)
    expect(screen.queryByTestId('spread-grid-inherit')).toBeNull()
    act(() => {
      undoBook()
    })
    expect(spreadGrid()).toEqual({ rows: 3 })
  })

  it('GP3: with linked margins ↺ on one margin resets all four', () => {
    seed({ margins: { top: 20, bottom: 20, inside: 20, outside: 20 } })
    render(<GridSection spreadId="s1" />)
    expect(
      screen.getByTestId('spread-grid-link').getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByTestId('spread-grid-reset-inside'))
    expect(spreadGrid()).toBeUndefined()
    for (const name of ['top', 'bottom', 'inside', 'outside']) {
      expect(input(name).value).toBe('15')
    }
  })

  it('GP3: unlinked ↺ resets only that margin', () => {
    seed({ margins: { top: 20, bottom: 12 } })
    render(<GridSection spreadId="s1" />)
    expect(
      screen.getByTestId('spread-grid-link').getAttribute('aria-pressed'),
    ).toBe('false')
    fireEvent.click(screen.getByTestId('spread-grid-reset-bottom'))
    expect(spreadGrid()).toEqual({ margins: { top: 20 } })
  })

  it('GP3: ↺ appears inside the fixed field (no new row or box)', () => {
    seed()
    openCustom()
    const field = box('columnGutterMm')
    const children = field.children.length
    commit('columnGutterMm', '8')
    expect(box('columnGutterMm')).toBe(field)
    expect(field.children.length).toBe(children + 1)
    expect(field.lastElementChild).toBe(reset('columnGutterMm'))
    expect(field.lastElementChild?.className).toBe('e7-ghost insp-grid-reset')
  })

  it('GP5: linked typing writes all four margins; link-on writes only margins ≠ T', () => {
    seed({ margins: { bottom: 9 } })
    openCustom()
    const link = screen.getByTestId('spread-grid-link')
    expect(link.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(link)
    expect(link.getAttribute('aria-pressed')).toBe('true')
    expect(spreadGrid()).toEqual({ margins: { bottom: 15 } })
    expect(getHistorySnapshot().undoLabel).not.toBeNull()
    commit('outside', '18')
    expect(spreadGrid()).toEqual({
      margins: { top: 18, bottom: 18, inside: 18, outside: 18 },
    })
  })

  it('GP5: link-on with equal margins writes nothing', () => {
    seed()
    openCustom()
    const link = screen.getByTestId('spread-grid-link')
    expect(link.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(link)
    expect(link.getAttribute('aria-pressed')).toBe('false')
    const before = getBookStoreSnapshot().book
    fireEvent.click(link)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('an override flips only that field; Use master resets every field', () => {
    seed()
    openCustom()
    commit('columns', '7')
    expect(box('columns').getAttribute('data-source')).toBe('spread')
    expect(box('rows').getAttribute('data-source')).toBe('book')
    const book = getBookStoreSnapshot().book
    expect(book.layoutGrid.columns).toBe(2)
    expect(book.spreads[0]?.layoutGrid).toEqual({ columns: 7 })
    expect(book.spreads[1]?.layoutGrid).toBeUndefined()
    fireEvent.click(source('Use master'))
    expect(spreadGrid()).toBeUndefined()
    expect(source('Use master').checked).toBe(true)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toContain(
      '2 × 2',
    )
  })

  it('with no master: "Use book", the book grid summary and hint', () => {
    load(makeBook({ spreads: [makeSpread({ id: 's1' })] }))
    render(<GridSection spreadId="s1" />)
    expect(source('Use book').checked).toBe(true)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toMatch(
      /^Book grid · 2 × 2 · /,
    )
    fireEvent.click(source('Custom'))
    expect(screen.getByTestId('spread-grid-hint').textContent).toBe(
      'Grey values follow the book grid.',
    )
    commit('rows', '3')
    expect(reset('rows')?.getAttribute('aria-label')).toBe(
      'Reset Rows to book grid',
    )
    expect(input('columns').title).toBe('Columns · from book grid')
  })

  it('the Show grid switch drives the shared overlay flag', () => {
    seed()
    render(<GridSection spreadId="s1" />)
    const toggle = screen.getByRole('switch', { name: 'Show grid' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(getGridVisible()).toBe(true)
    expect(
      screen
        .getByRole('switch', { name: 'Show grid' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: 'Show grid' }))
    expect(getGridVisible()).toBe(false)
  })

  it('clamps counts to 1–12 and one edit is one undo step', () => {
    seed()
    openCustom()
    commit('columns', '30')
    expect(spreadGrid()).toEqual({ columns: 12 })
    expect(input('columns').value).toBe('12')
    act(() => {
      undoBook()
    })
    expect(spreadGrid()).toBeUndefined()
  })

  it('ignores a cleared field', () => {
    seed()
    openCustom()
    commit('columns', '')
    expect(spreadGrid()).toBeUndefined()
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    const { container } = render(<GridSection spreadId="nope" />)
    expect(container.textContent).toBe('')
  })
})

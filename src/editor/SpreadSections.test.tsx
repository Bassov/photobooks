import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { effectiveGrid } from '../core/grid/layoutGrid'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import type { Book, Spread } from '../core'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { getFrameSource, setFrameSource } from './frameSelection'
import {
  getLeftPanelTab,
  getPickedParentId,
  resetLeftPanelTabForTests,
} from './leftPanelTabStore'
import { BackgroundSection, MasterSpacingSection } from './SpreadSections'

function seed(
  first: Partial<Spread> = {},
  pageColor?: string,
  rest: Pick<Book, 'parents' | 'defaultParentId'> = {},
) {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1', ...first }), makeSpread({ id: 's2' })],
      ...(pageColor === undefined ? {} : { settings: { pageColor } }),
      ...rest,
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function spread(index: number) {
  return getBookStoreSnapshot().book.spreads[index]
}

function masterSelect() {
  return screen.getByRole<HTMLSelectElement>('combobox', { name: 'Master' })
}

function pickMaster(value: string) {
  fireEvent.change(masterSelect(), { target: { value } })
}

function status() {
  return screen.getByTestId('spread-master-status')
}

function slider(testId: string) {
  return within(screen.getByTestId(testId)).getByRole('slider')
}

/** Real focus, so the field's own `blur()` on Enter / Escape fires onBlur. */
function focus(el: HTMLElement) {
  act(() => {
    el.focus()
  })
}

function swatch(color: string) {
  return within(screen.getByTestId('bg-swatches')).getByRole('button', {
    name: `Background ${color}`,
  })
}

afterEach(cleanup)

const PARENTS: Pick<Book, 'parents'> = {
  parents: [
    { id: 'pa', name: 'Master A', frames: [], guides: [] },
    { id: 'pb', name: 'Master B', frames: [], guides: [] },
  ],
}

describe('MasterSpacingSection', () => {
  it('is the kit "Master & spacing" section: a select of the book parents + None, the default labelled', () => {
    seed({}, undefined, { ...PARENTS, defaultParentId: 'pa' })
    render(<MasterSpacingSection spreadId="s1" />)
    expect(
      within(screen.getByTestId('spread-master-spacing')).getByText(
        'Master & spacing',
      ),
    ).toBeTruthy()
    const options = Array.from(masterSelect().options)
    expect(options.map((o) => [o.value, o.textContent])).toEqual([
      ['pa', 'Master A · default'],
      ['pb', 'Master B'],
      ['', 'None'],
    ])
    expect(masterSelect().value).toBe('pa')
    expect(status().textContent).toBe('Book defaultEdit master')
  })

  it('stays a select for one master', () => {
    seed({}, undefined, {
      parents: [{ id: 'pa', name: 'Master A', frames: [], guides: [] }],
      defaultParentId: 'pa',
    })
    render(<MasterSpacingSection spreadId="s1" />)
    expect(
      Array.from(masterSelect().options).map((o) => o.textContent),
    ).toEqual(['Master A · default', 'None'])
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('hides the Master select and status when the book has no parents, keeping the sliders', () => {
    seed()

    render(<MasterSpacingSection spreadId="s1" />)

    expect(screen.queryByRole('combobox', { name: 'Master' })).toBeNull()
    expect(screen.queryByTestId('spread-master-status')).toBeNull()
    expect(screen.getByTestId('spread-margin')).toBeTruthy()
  })

  it('the Master choice applies a parent to this spread only; the default clears it back', () => {
    seed({}, undefined, { ...PARENTS, defaultParentId: 'pa' })
    render(<MasterSpacingSection spreadId="s1" />)
    pickMaster('pb')
    expect(spread(0)?.parentId).toBe('pb')
    expect(masterSelect().value).toBe('pb')
    expect(status().textContent).toBe('Instead of Master AEdit master')
    expect(spread(1)).not.toHaveProperty('parentId')
    pickMaster('')
    expect(spread(0)?.parentId).toBeNull()
    expect(status().textContent).toBe('No master on this spread')
    expect(screen.queryByTestId('spread-master-edit')).toBeNull()
    pickMaster('pa')
    expect(spread(0)).not.toHaveProperty('parentId')
    act(() => {
      undoBook()
    })
    expect(spread(0)?.parentId).toBeNull()
  })

  it('without a default an explicit master reads its name', () => {
    seed({ parentId: 'pb' }, undefined, PARENTS)
    render(<MasterSpacingSection spreadId="s1" />)
    expect(status().textContent).toBe('Master BEdit master')
  })

  it('Edit master opens Masters mode on the shown master and drops the picked frame', () => {
    seed({ parentId: 'pb' }, undefined, { ...PARENTS, defaultParentId: 'pa' })
    setFrameSource({ spreadId: 's1', frameId: 'f1' })
    render(<MasterSpacingSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('spread-master-edit'))
    expect(getLeftPanelTab()).toBe('masters')
    expect(getPickedParentId()).toBe('pb')
    expect(getFrameSource()).toBeNull()
    resetLeftPanelTabForTests()
  })

  it('Margin sets all four spread margins, Gap both gutters', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    fireEvent.change(slider('spread-margin'), { target: { value: '18' } })
    fireEvent.change(slider('spread-gap'), { target: { value: '7' } })
    const book = getBookStoreSnapshot().book
    const { values, source } = effectiveGrid(book, spread(0))
    expect([values.top, values.bottom, values.inside, values.outside]).toEqual([
      18, 18, 18, 18,
    ])
    expect([values.columnGutterMm, values.rowGutterMm]).toEqual([7, 7])
    expect(source.top).toBe('spread')
    expect(effectiveGrid(book, spread(1)).source.top).not.toBe('spread')
    expect(
      within(screen.getByTestId('spread-margin')).getByRole<HTMLInputElement>(
        'textbox',
        { name: 'Margin value' },
      ).value,
    ).toBe('18 mm')
    undoBook()
    expect(
      effectiveGrid(getBookStoreSnapshot().book, spread(0)).values
        .columnGutterMm,
    ).not.toBe(7)
  })

  it('the kit value field edits Margin: bare number on focus, Enter commits clamped', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    const field = within(
      screen.getByTestId('spread-margin'),
    ).getByRole<HTMLInputElement>('textbox', { name: 'Margin value' })
    const before = field.value
    expect(before).toMatch(/^\d+ mm$/)
    focus(field)
    expect(field.value).toBe(before.replace(' mm', ''))
    expect([field.selectionStart, field.selectionEnd]).toEqual([
      0,
      field.value.length,
    ])
    fireEvent.change(field, { target: { value: '12,6' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(document.activeElement).not.toBe(field)
    expect(field.value).toBe('13 mm')
    expect(
      effectiveGrid(getBookStoreSnapshot().book, spread(0)).values.top,
    ).toBe(13)
    focus(field)
    fireEvent.change(field, { target: { value: '99' } })
    fireEvent.blur(field)
    expect(
      effectiveGrid(getBookStoreSnapshot().book, spread(0)).values.top,
    ).toBe(30)
    expect(field.value).toBe('30 mm')
    focus(field)
    fireEvent.change(field, { target: { value: '-4' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(
      effectiveGrid(getBookStoreSnapshot().book, spread(0)).values.top,
    ).toBe(0)
  })

  it('Escape and a non-number leave the value; other keys do not commit', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    const field = within(
      screen.getByTestId('spread-gap'),
    ).getByRole<HTMLInputElement>('textbox', { name: 'Gap value' })
    const gap = () =>
      effectiveGrid(getBookStoreSnapshot().book, spread(0)).values
        .columnGutterMm
    const start = gap()
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      errors.push(event.error)
    }
    window.addEventListener('error', onError)
    focus(field)
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(field.value).toBe(`${String(start)} mm`)
    focus(field)
    fireEvent.change(field, { target: { value: '9' } })
    fireEvent.keyDown(field, { key: 'a' })
    expect(field.value).toBe('9')
    expect(gap()).toBe(start)
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(document.activeElement).not.toBe(field)
    expect(gap()).toBe(start)
    expect(field.value).toBe(`${String(start)} mm`)
    fireEvent.blur(field)
    expect(gap()).toBe(start)
    focus(field)
    fireEvent.change(field, { target: { value: 'abc' } })
    fireEvent.blur(field)
    expect(gap()).toBe(start)
    expect(field.value).toBe(`${String(start)} mm`)
    window.removeEventListener('error', onError)
    // A blur with no draft (after Escape) is a no-op, not a crash.
    expect(errors).toEqual([])
  })

  it('the slider ranges are the kit 0–30 mm margin and 0–20 mm gap', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    expect(slider('spread-margin').getAttribute('max')).toBe('30')
    expect(slider('spread-gap').getAttribute('max')).toBe('20')
    expect(slider('spread-margin').getAttribute('min')).toBe('0')
  })

  it('notes the re-flow only for a spread without a catalog template', () => {
    seed()
    const { unmount } = render(<MasterSpacingSection spreadId="s1" />)
    expect(
      screen.getByText('Margin and gap re-flow template layouts'),
    ).toBeTruthy()
    unmount()
    seed({ templateId: 'user-abc' })
    const saved = render(<MasterSpacingSection spreadId="s1" />)
    expect(
      screen.getByText('Margin and gap re-flow template layouts'),
    ).toBeTruthy()
    saved.unmount()
    seed({ templateId: 'full-bleed' })
    render(<MasterSpacingSection spreadId="s1" />)
    expect(
      screen.queryByText('Margin and gap re-flow template layouts'),
    ).toBeNull()
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    const { container } = render(<MasterSpacingSection spreadId="nope" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('BackgroundSection', () => {
  it('lists the kit swatches in kit order, white pressed by default', () => {
    seed()
    render(<BackgroundSection spreadId="s1" />)
    const swatches = within(screen.getByTestId('bg-swatches')).getAllByRole(
      'button',
    )
    expect(swatches.map((s) => s.getAttribute('data-swatch'))).toEqual([
      '#ffffff',
      '#f4f4f4',
      '#e9e9e9',
      '#e3e3e3',
      '#2a2927',
      '#111111',
    ])
    expect(swatches.map((s) => s.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ])
    expect(swatch('#2a2927').style.background).toBe('#2a2927')
  })

  it('a swatch sets only this spread background', () => {
    seed()
    render(<BackgroundSection spreadId="s1" />)
    fireEvent.click(swatch('#2a2927'))
    expect(spread(0)?.backgroundColor).toBe('#2a2927')
    expect(spread(1)).not.toHaveProperty('backgroundColor')
    expect(swatch('#2a2927').getAttribute('aria-pressed')).toBe('true')
    expect(swatch('#ffffff').getAttribute('aria-pressed')).toBe('false')
  })

  it('falls back to the book page colour, case-insensitively', () => {
    seed({}, '#E9E9E9')
    render(<BackgroundSection spreadId="s1" />)
    expect(swatch('#e9e9e9').getAttribute('aria-pressed')).toBe('true')
    expect(swatch('#ffffff').getAttribute('aria-pressed')).toBe('false')
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    const { container } = render(<BackgroundSection spreadId="nope" />)
    expect(container.innerHTML).toBe('')
  })
})

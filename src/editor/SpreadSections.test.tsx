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
import type { Spread } from '../core'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { BackgroundSection, MasterSpacingSection } from './SpreadSections'

function seed(first: Partial<Spread> = {}, pageColor?: string) {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1', ...first }), makeSpread({ id: 's2' })],
      ...(pageColor === undefined ? {} : { settings: { pageColor } }),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function spread(index: number) {
  return getBookStoreSnapshot().book.spreads[index]
}

function master(name: string) {
  return within(
    screen.getByRole('radiogroup', { name: 'Master' }),
  ).getByRole<HTMLInputElement>('radio', { name })
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

describe('MasterSpacingSection', () => {
  it('is the kit "Master & spacing" section, Master A by default', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    expect(
      within(screen.getByTestId('spread-master-spacing')).getByText(
        'Master & spacing',
      ),
    ).toBeTruthy()
    const radios = within(
      screen.getByRole('radiogroup', { name: 'Master' }),
    ).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual([
      'A',
      'B',
      'none',
    ])
    expect(master('Master A').checked).toBe(true)
    expect(master('Master B').checked).toBe(false)
  })

  it('the Master choice writes the spread master; A clears it back', () => {
    seed()
    render(<MasterSpacingSection spreadId="s1" />)
    fireEvent.click(master('None'))
    expect(spread(0)?.masterId).toBe('none')
    expect(master('None').checked).toBe(true)
    expect(spread(1)).not.toHaveProperty('masterId')
    fireEvent.click(master('Master B'))
    expect(spread(0)?.masterId).toBe('B')
    fireEvent.click(master('Master A'))
    expect(spread(0)).toBeDefined()
    expect(spread(0)).not.toHaveProperty('masterId')
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

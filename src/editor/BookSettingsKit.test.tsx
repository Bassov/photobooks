import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'
import { ReadOnlyPill } from './InspectorControls'

function seed(widthMm: number, heightMm: number) {
  resetBookStore({
    book: makeBook({ settings: { trim: { widthMm, heightMm } } }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const trim = () => getBookStoreSnapshot().book.settings.trim
const select = () => screen.getByTestId<HTMLSelectElement>('size-preset')
const labels = () => [...select().options].map((o) => o.textContent)

afterEach(() => {
  cleanup()
  resetBookStore()
})

// Kit SizeEditor: uikit/src/sandbox/v7.tsx:58,160-179.
describe('Book settings page size select', () => {
  it('lists the kit presets with short × long cm, then Custom', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    expect(labels()).toEqual([
      'A6 · 10.5 × 14.8 cm',
      'A5 · 14.8 × 21 cm',
      'A4 · 21 × 29.7 cm',
      'A3 · 29.7 × 42 cm',
      'Letter · 21.6 × 27.9 cm',
      'Square 20×20 · 20 × 20 cm',
      'Square 30×30 · 30 × 30 cm',
      'Custom',
    ])
  })

  it('swaps the long and short side in landscape but never a square', () => {
    seed(300, 200)
    render(<BookSettingsSection />)
    expect(labels()).toContain('A5 · 21 × 14.8 cm')
    expect(labels()).toContain('Square 20×20 · 20 × 20 cm')
  })

  it('shows the matching preset in either orientation, else Custom', () => {
    seed(148, 210)
    const { unmount } = render(<BookSettingsSection />)
    expect(select().value).toBe('A5')
    unmount()
    seed(210, 148)
    const second = render(<BookSettingsSection />)
    expect(select().value).toBe('A5')
    second.unmount()
    seed(150, 210)
    render(<BookSettingsSection />)
    expect(select().value).toBe('custom')
  })

  it('does not match a preset by width alone or by height alone', () => {
    seed(148, 211)
    const { unmount } = render(<BookSettingsSection />)
    expect(select().value).toBe('custom')
    unmount()
    seed(149, 210)
    render(<BookSettingsSection />)
    expect(select().value).toBe('custom')
  })

  it('writes a preset in portrait, in landscape and square', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    fireEvent.change(select(), { target: { value: 'A4' } })
    expect(trim()).toEqual({ widthMm: 210, heightMm: 297 })
    fireEvent.change(select(), { target: { value: 'sq30' } })
    expect(trim()).toEqual({ widthMm: 300, heightMm: 300 })
    cleanup()
    seed(300, 200)
    render(<BookSettingsSection />)
    fireEvent.change(select(), { target: { value: 'A4' } })
    expect(trim()).toEqual({ widthMm: 297, heightMm: 210 })
    fireEvent.change(select(), { target: { value: 'sq20' } })
    expect(trim()).toEqual({ widthMm: 200, heightMm: 200 })
  })

  it('Custom keeps the size and shows the unit switch; a preset hides it', () => {
    seed(148, 210)
    render(<BookSettingsSection />)
    expect(screen.queryByTestId('size-unit')).toBeNull()
    fireEvent.change(select(), { target: { value: 'custom' } })
    expect(select().value).toBe('custom')
    expect(trim()).toEqual({ widthMm: 148, heightMm: 210 })
    expect(screen.getByTestId('size-unit')).toBeTruthy()
    fireEvent.change(select(), { target: { value: 'A6' } })
    expect(select().value).toBe('A6')
    expect(screen.queryByTestId('size-unit')).toBeNull()
  })
})

// Kit Print / Binding / Defaults rows: uikit/src/sandbox/v7.tsx:205-210.
describe('Book settings read-only rows', () => {
  it('shows bleed and safe margin as fields with mono values and mm units', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    const bleed = screen.getByTestId('book-bleed')
    expect(bleed.textContent).toContain('B')
    expect(bleed.textContent).toContain('mm')
    expect(bleed.textContent).toContain(
      String(getBookStoreSnapshot().book.settings.bleedMm),
    )
    expect(screen.getByTestId('book-safe-margin').textContent).toContain('S')
    expect(screen.getByText('Matte 200 g')).toBeTruthy()
    expect(screen.getByText('Default master')).toBeTruthy()
    expect(screen.getByText('Master A')).toBeTruthy()
    expect(screen.getByTestId('book-pages-note').textContent).toBe(
      'Add 9 spreads to reach the 20-page minimum',
    )
    expect(screen.getByTestId('binding-style').textContent).toBe('Hardcover')
  })
})

// Kit v7.tsx:202,207-208: meta line names the book; Pages follows the spreads.
describe('Book settings header and pages', () => {
  it('names the book by its back text and counts pages from spreads', () => {
    resetBookStore({
      book: makeBook({
        title: 'Lake trip',
        spreads: Array.from({ length: 10 }, (_, i) =>
          makeSpread({ id: `s${String(i)}` }),
        ),
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<BookSettingsSection />)
    expect(screen.getByTestId('book-settings-subtitle').textContent).toBe(
      'Lake trip · applies to the whole book',
    )
    expect(screen.getByTestId('book-pages').textContent).toBe('20–120')
    expect(screen.getByTestId<HTMLInputElement>('book-pages-input').value).toBe(
      '20',
    )
    expect(screen.getByTestId('book-pages-range').style.color).toBe(SUB)
    expect(screen.getByTestId('book-pages-note').textContent).toBe(
      'Pages are added in spreads of 2',
    )
  })
})

describe('Book settings Pages field (rendered #/demo step 24)', () => {
  const spreads = () => getBookStoreSnapshot().book.spreads.length
  const field = () => screen.getByTestId<HTMLInputElement>('book-pages-input')

  it('is a kit Val box number input: 20–120, step 2', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    const input = field()
    expect(input.type).toBe('number')
    expect([input.min, input.max, input.step]).toEqual(['20', '120', '2'])
    expect(input.className).toBe(
      'insp-pages-field rounded-sm px-2 py-1 text-sm',
    )
    expect(input.style.background).toBe(FIELD)
    expect(input.style.color).toBe(T)
    expect(input.style.width).toBe('calc(2ch + 1rem)')
    fireEvent.change(input, { target: { value: '120' } })
    expect(input.style.width).toBe('calc(3ch + 1rem)')
  })

  it('commits a typed count on Enter or blur, clamped to whole spreads', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    fireEvent.change(field(), { target: { value: '9' } })
    expect(spreads()).toBe(1)
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(spreads()).toBe(10)
    expect(field().value).toBe('20')
    fireEvent.change(field(), { target: { value: '27' } })
    fireEvent.keyDown(field(), { key: 'a' })
    expect(spreads()).toBe(10)
    fireEvent.blur(field())
    expect(spreads()).toBe(14)
    expect(field().value).toBe('28')
  })

  it('Escape and empty input keep the spreads', () => {
    seed(200, 300)
    render(<BookSettingsSection />)
    fireEvent.change(field(), { target: { value: '40' } })
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(field().value).toBe('2')
    fireEvent.blur(field())
    expect(spreads()).toBe(1)
    fireEvent.change(field(), { target: { value: '' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(spreads()).toBe(1)
    expect(field().value).toBe('2')
  })
})

describe('ReadOnlyPill', () => {
  it('paints the FIELD pill and a muted note only when given', () => {
    const { rerender } = render(<ReadOnlyPill value="X" testId="pill" />)
    const pill = screen.getByTestId('pill')
    expect(pill.style.background).toBe(FIELD)
    expect(pill.style.color).toBe(T)
    expect(screen.queryByText('note')).toBeNull()
    rerender(<ReadOnlyPill value="X" note="note" noteTestId="n" />)
    const note = screen.getByTestId('n')
    expect(note.textContent).toBe('note')
    expect(note.style.color).toBe(SUB)
  })
})

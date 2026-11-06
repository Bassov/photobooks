import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { spreadsForPages } from '../core/pages'
import {
  makeBook,
  makeCustomPrintProfile,
  makeSpread,
} from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
} from './bookStore'
import {
  resetPrintProfilesForTests,
  savePrintProfile,
} from './printProfilesStore'

const CUSTOM = makeCustomPrintProfile()

function seed(pages = 20) {
  resetBookStore({
    book: makeBook({
      settings: { trim: { widthMm: 200, heightMm: 200 } },
      spreads: Array.from({ length: spreadsForPages(pages) }, (_, i) =>
        makeSpread({ id: `s${String(i + 1)}` }),
      ),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
  savePrintProfile(CUSTOM)
}

const printer = () =>
  screen.getByTestId<HTMLSelectElement>('book-print-profile')
const issues = () =>
  screen.queryAllByTestId('book-print-issue').map((n) => n.textContent)

afterEach(() => {
  cleanup()
  resetPrintProfilesForTests()
  resetBookStore()
})

// Kit v7.tsx:305-313 Book settings PRINT.
describe('Book settings Printer', () => {
  it('groups print shops and customs and starts on Generic', () => {
    seed()
    render(<BookSettingsSection />)
    expect(printer().getAttribute('aria-label')).toBe('Printer')
    expect(printer().value).toBe('generic')
    const groups = [...printer().querySelectorAll('optgroup')].map((g) => [
      g.label,
      [...g.querySelectorAll('option')].map((o) => o.textContent),
    ])
    expect(groups).toEqual([
      ['Print shops', ['Generic']],
      ['Custom', [CUSTOM.name]],
    ])
    expect(screen.getByTestId('book-print-hint').textContent).toBe(
      '5–50 cm · 20–120 pages · photos ≥ 200 ppi',
    )
    expect(issues()).toEqual([])
    expect(screen.getByTestId('book-pages-range').textContent).toBe('20–120')
  })

  it('picks a profile in one undo step: hint, warnings, B / S and pages follow', () => {
    seed()
    render(<BookSettingsSection />)
    fireEvent.change(printer(), { target: { value: CUSTOM.id } })
    expect(getBookStoreSnapshot().book.printProfile?.id).toBe(CUSTOM.id)
    expect(getHistorySnapshot().undoLabel).toBe('Printer')
    expect(printer().value).toBe(CUSTOM.id)
    expect(screen.getByText(`Printer: ${CUSTOM.name}`)).toBeTruthy()
    expect(screen.getByTestId('book-print-hint').textContent).toBe(
      '15–30 cm · 24–80 pages · photos ≥ 300 ppi',
    )
    expect(issues()).toEqual([
      `${CUSTOM.name} prints at least 24 pages; this book’s 20 print as 24.`,
    ])
    expect(
      screen.getByTestId('book-print-issue').getAttribute('style'),
    ).toContain('color: #8a5a12')
    expect(screen.getByTestId('book-bleed').textContent).toContain('3.175')
    expect(screen.getByTestId('book-safe-margin').textContent).toContain('12.7')
    expect(screen.getByTestId('book-pages-range').textContent).toBe('20–80')
    const pages = screen.getByTestId<HTMLInputElement>('book-pages-input')
    expect([pages.min, pages.max, pages.step]).toEqual(['20', '80', '4'])
  })
})

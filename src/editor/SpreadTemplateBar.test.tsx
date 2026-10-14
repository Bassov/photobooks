import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { Pasteboard } from './Pasteboard'

const editorShellCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'EditorShell.css'),
  'utf8',
)

describe('SpreadTemplateBar', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('applies 4-grid to the marked spread only', () => {
    resetBookStore()
    render(<Pasteboard />)

    expect(
      screen.getByRole('radiogroup', { name: 'Spread template' }),
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Full bleed' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'One per page' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '2-up' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '4-grid' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add spread' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'One per page' })).toHaveProperty(
      'checked',
      true,
    )
    expect(editorShellCss).toMatch(
      /\.spread-template-bar input:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/,
    )
    expect(editorShellCss).toMatch(
      /\.spread-template-bar button:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/,
    )

    const before = getBookStoreSnapshot().book.spreads.map(
      (spread) => spread.frames.length,
    )
    const middle = before[1]
    const last = before[2]
    if (middle === undefined || last === undefined) {
      throw new Error('expected session spreads')
    }
    fireEvent.click(screen.getByRole('radio', { name: '4-grid' }))

    const after = getBookStoreSnapshot().book.spreads
    expect(after[0]?.frames).toHaveLength(4)
    expect(after[1]?.frames).toHaveLength(middle)
    expect(after[2]?.frames).toHaveLength(last)
    expect(screen.getAllByTestId('spread-frame-placeholder')).toHaveLength(4)
  })
})

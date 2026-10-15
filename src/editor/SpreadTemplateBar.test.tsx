import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { Pasteboard } from './Pasteboard'
import { SpreadTemplateBar } from './SpreadTemplateBar'

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

  it('ignores a template change when no spread is marked', () => {
    resetBookStore()
    const before = getBookStoreSnapshot().book
    render(<SpreadTemplateBar spreadId={null} onAddSpread={() => undefined} />)
    const radio = screen.getByRole('radio', { name: '4-grid' })
    expect(radio).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Add spread' })).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.change(radio)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('scrolls the pasteboard to the spread added at the end', () => {
    resetBookStore()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      value: 900,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(4)
    expect(scroll.scrollTop).toBe(900)
  })

  it('marks the spread that fills the pasteboard', () => {
    resetBookStore()
    const ratios = [0.4, 1, 0.2]
    class FakeIntersectionObserver {
      lastTarget: Element | undefined

      constructor(private readonly callback: IntersectionObserverCallback) {}

      observe(target: Element): void {
        this.lastTarget = target
        const index = Number((target as HTMLElement).dataset.slotIndex)
        const ratio = ratios[index] ?? 0
        this.callback(
          [
            {
              target,
              intersectionRatio: ratio,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        )
      }

      unobserve(target: Element): void {
        this.lastTarget = target
      }

      disconnect(): void {
        this.lastTarget = undefined
      }

      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    const clientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    )
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 800
      },
    })

    try {
      render(<Pasteboard />)
      const active = screen
        .getAllByTestId('pasteboard-slot')
        .find((slot) => slot.getAttribute('data-active') === 'true')
      expect(active?.getAttribute('data-slot-index')).toBe('1')
    } finally {
      vi.unstubAllGlobals()
      if (clientHeight !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientHeight',
          clientHeight,
        )
      }
    }
  })
})

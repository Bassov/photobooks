import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Book } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { LayoutCycle } from './LayoutCycle'
import { resetLeftPanelTabForTests, setLeftPanelTab } from './leftPanelTabStore'
import { LAYOUT_CYCLE_MIN_GAP_PX } from './pageLabelsModel'

const photos = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    makeFrame({ id: `f${String(i)}`, z: i }),
  )

function seed(count: number, templateId?: string): void {
  const book: Book = makeBook({
    spreads: [
      makeSpread({ id: 's0', frames: photos(1) }),
      makeSpread({
        id: 's1',
        frames: photos(count),
        ...(templateId === undefined ? {} : { templateId }),
      }),
      makeSpread({ id: 's2', frames: photos(1) }),
    ],
  })
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

afterEach(() => {
  cleanup()
  resetBookStore()
  resetLeftPanelTabForTests()
})

describe('LayoutCycle', () => {
  it('names the layout and its place in the set with a stable-width cell', () => {
    seed(2, 'offset-pair')
    render(<LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />)
    const pill = screen.getByRole('group', { name: 'Layout' })
    expect(screen.getByTestId('layout-cycle-name').textContent).toBe(
      'Offset pair',
    )
    expect(screen.getByTestId('layout-cycle-pos').textContent).toBe('2/2')
    expect(
      [...pill.querySelectorAll('.layout-cycle-width')].map(
        (span) => span.textContent,
      ),
    ).toEqual(['One per page', 'Offset pair'])
    expect(pill.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Offset pair, 2 of 2',
    )
    expect(pill.dataset.gapPx).toBe('106')
    expect(pill.dataset.gapMin).toBe(String(LAYOUT_CYCLE_MIN_GAP_PX))
    expect(pill.dataset.pageSide).toBeUndefined()
    expect(pill.hasAttribute('data-camera-frame')).toBe(true)
  })

  it('shows Custom, steps with the buttons and keeps the frame ids', () => {
    seed(2)
    render(<LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />)
    expect(screen.getByTestId('layout-cycle-name').textContent).toBe('Custom')
    expect(screen.getByTestId('layout-cycle-pos').textContent).toBe('–/2')
    expect(
      screen.getByTestId('layout-cycle-name').parentElement?.dataset.custom,
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Next layout' }))
    expect(screen.getByTestId('layout-cycle-name').textContent).toBe(
      'One per page',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Previous layout' }))
    const spread = getBookStoreSnapshot().book.spreads[1]
    expect(spread?.templateId).toBe('offset-pair')
    expect(spread?.frames.map((frame) => frame.id)).toEqual(['f0', 'f1'])
  })

  it('marks the first layout 1/n, not Custom; each button has its glyph and keys', () => {
    seed(2, 'one-per-page')
    render(<LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />)
    expect(screen.getByTestId('layout-cycle-pos').textContent).toBe('1/2')
    const name = screen.getByTestId('layout-cycle-name')
    expect(name.textContent).toBe('One per page')
    expect(name.parentElement?.dataset.custom).toBeUndefined()
    const prev = screen.getByTestId('layout-cycle-prev')
    const next = screen.getByTestId('layout-cycle-next')
    expect(prev.getAttribute('aria-label')).toBe('Previous layout')
    expect(next.getAttribute('aria-label')).toBe('Next layout')
    expect(prev.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(
      'chevronLeft',
    )
    expect(next.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(
      'chevronRight',
    )
    for (const [button, tip] of [
      [prev, 'Previous layout ⇧['],
      [next, 'Next layout ⇧]'],
    ] as const) {
      fireEvent.keyDown(document.body, { key: 'Tab' })
      act(() => {
        button.focus()
      })
      expect(screen.getByRole('tooltip').textContent).toBe(tip)
      act(() => {
        button.blur()
      })
    }
  })

  it('renders nothing for a slot past the last spread', () => {
    seed(2)
    render(<LayoutCycle spreadId="s1" slotIndex={9} side={null} gapPx={106} />)
    expect(screen.queryByTestId('layout-cycle')).toBeNull()
  })

  it('centres a single page on its side; slot 0 passes no gap', () => {
    seed(2)
    render(<LayoutCycle spreadId="s0" slotIndex={0} side="right" gapPx={20} />)
    const pill = screen.getByTestId('layout-cycle')
    expect(pill.dataset.pageSide).toBe('right')
    expect(pill.dataset.gapPx).toBeUndefined()
  })

  it('keeps pointerdown from the pasteboard', () => {
    seed(2)
    const onPointerDown = vi.fn()
    render(
      <div onPointerDown={onPointerDown}>
        <LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />
      </div>,
    )
    fireEvent.pointerDown(screen.getByTestId('layout-cycle-name'))
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('renders nothing with fewer than two layouts, a stale slot or in Masters', () => {
    seed(5, 'hero-grid')
    const { rerender } = render(
      <LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />,
    )
    expect(screen.queryByTestId('layout-cycle')).toBeNull()
    seed(2)
    rerender(
      <LayoutCycle spreadId="s9" slotIndex={1} side={null} gapPx={106} />,
    )
    expect(screen.queryByTestId('layout-cycle')).toBeNull()
    rerender(
      <LayoutCycle spreadId="s1" slotIndex={1} side={null} gapPx={106} />,
    )
    expect(screen.getByTestId('layout-cycle')).toBeTruthy()
    act(() => {
      setLeftPanelTab('masters')
    })
    expect(screen.queryByTestId('layout-cycle')).toBeNull()
  })
})

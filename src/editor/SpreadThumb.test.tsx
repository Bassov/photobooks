import assert from 'node:assert/strict'
import { Profiler } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSpread, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { patchRelinkStatus, resetRelinkStore } from './relink/statusStore'
import { SpreadThumb } from './SpreadThumb'
import { resetThumbCache, setThumbUrl } from './thumbCache'

function twoSpreadBook() {
  let book = makeBook({
    id: 'two',
    spreads: [],
    gallery: ['a', 'b'],
    assets: { a: {}, b: {} },
  })
  book = addSpread(book, { id: 's0' })
  book = addSpread(book, { id: 's1' })
  const left = book.spreads[0]?.frames[0]
  const right = book.spreads[1]?.frames[0]
  assert(left !== undefined && right !== undefined, 'expected frames')
  book = placeAsset(book, 's0', left.id, 'a')
  book = placeAsset(book, 's1', right.id, 'b')
  return book
}

function seed(previewUrls = new Map<string, string>()) {
  const book = twoSpreadBook()
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls,
    importRunning: false,
    importExpectedCount: 0,
  })
  return book
}

describe('SpreadThumb', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetRelinkStore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    const { container } = render(
      <SpreadThumb spreadId="nope" boxWidthPx={128} boxHeightPx={1000} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('paints an inert view scaled to the requested width', () => {
    seed()
    const { container } = render(
      <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />,
    )
    const view = container.firstElementChild as HTMLElement
    expect(view.classList.contains('spread-view--thumb')).toBe(true)
    expect(view.getAttribute('aria-hidden')).toBe('true')
    expect(view.style.width).toBe('128px')
    expect(screen.queryByTestId('spread-view')).toBeNull()
    expect(screen.queryByTestId('spread-frame')).toBeNull()
    expect(view.querySelector('[data-frame-id]')).toBeNull()
  })

  it('shows the filmstrip thumb, and picks up one that arrives later', () => {
    seed()
    const { container } = render(
      <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />,
    )
    expect(container.querySelector('img')).toBeNull()
    act(() => {
      setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    })
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'blob:thumb',
    )
  })

  it('falls back to the book preview url when there is no thumb', () => {
    seed(new Map([['a', 'data:image/svg+xml,preview']]))
    const { container } = render(
      <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/svg+xml,preview',
    )
  })

  it('prefers the thumb over the book preview url', () => {
    seed(new Map([['a', 'data:image/svg+xml,preview']]))
    setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    const { container } = render(
      <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'blob:thumb',
    )
  })

  it('hatches a missing asset and clears when it is found again', () => {
    seed(new Map([['a', 'data:image/svg+xml,preview']]))
    const { container } = render(
      <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />,
    )
    expect(container.querySelector('.spread-frame-missing')).toBeNull()
    act(() => {
      patchRelinkStatus('a', 'missing')
    })
    expect(container.querySelector('.spread-frame-missing')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
    act(() => {
      patchRelinkStatus('a', 'ok')
    })
    expect(container.querySelector('.spread-frame-missing')).toBeNull()
  })

  it('re-renders only when its own spread changes', () => {
    const book = seed(
      new Map([
        ['a', 'x'],
        ['b', 'y'],
      ]),
    )
    const counts = { s0: 0, s1: 0 }
    render(
      <>
        <Profiler id="s0" onRender={() => (counts.s0 += 1)}>
          <SpreadThumb spreadId="s0" boxWidthPx={128} boxHeightPx={1000} />
        </Profiler>
        <Profiler id="s1" onRender={() => (counts.s1 += 1)}>
          <SpreadThumb spreadId="s1" boxWidthPx={128} boxHeightPx={1000} />
        </Profiler>
      </>,
    )
    const before = { ...counts }
    const frameId = book.spreads[0]?.frames[0]?.id
    assert(frameId !== undefined, 'expected frame')
    act(() => {
      dispatchBookOp({ type: 'unplace', spreadId: 's0', frameId })
    })
    expect(counts.s0).toBeGreaterThan(before.s0)
    expect(counts.s1).toBe(before.s1)
  })
})

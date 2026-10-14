import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import {
  getBookStoreSnapshot,
  resetBookStore,
  type AssetSessionMeta,
} from './bookStore'
import { Filmstrip } from './Filmstrip'
import { seedGallery } from './gallery.test-helpers'
import { resetThumbCache } from './thumbCache'
import {
  buildStridePrefix,
  indexFromScrollOffset,
  spacerWidthPx,
  thumbSlotSize,
  thumbStride,
  windowCountForCover,
  THUMB_WIDTH_MAX,
} from './thumbSlotSize'

const filmstripCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Filmstrip.css'),
  'utf8',
)

function seedMixedAspectGallery(): void {
  resetBookStore()
  const ids = ['land', 'port', 'square'] as const
  const aspects = [1.5, 0.5, 1] as const
  const snap = getBookStoreSnapshot()
  const assets: Record<string, Record<string, never>> = {}
  const sessionMeta = new Map<string, AssetSessionMeta>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    const aspect = aspects[i]
    if (id === undefined || aspect === undefined) {
      continue
    }
    assets[id] = {}
    sessionMeta.set(id, {
      name: id,
      correctedWidth: Math.round(100 * aspect),
      correctedHeight: 100,
      orientation: 1,
      aspect,
    })
  }
  resetBookStore({
    book: { ...snap.book, assets, gallery: [...ids] },
    sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
}

function stubScrollportWidth(width: number): () => void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('data-testid') ===
        'filmstrip-scroll'
        ? width
        : 0
    },
  })
  return () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  }
}

describe('Filmstrip viewport containment', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
  })

  it('sizes the spacer from aspect-driven strides', () => {
    seedGallery(80)
    render(<Filmstrip />)

    const spacer = document.querySelector('.filmstrip-spacer')
    expect(spacer).toBeTruthy()
    const aspects = Array.from({ length: 80 }, () => 1.5)
    expect((spacer as HTMLElement).style.width).toBe(
      `${String(spacerWidthPx(aspects, 80))}px`,
    )
    expect(
      screen.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    ).toBe('80')
  })

  it('declares CSS containment so a wide spacer cannot grow the page', () => {
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*min-width:\s*0/s)
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*max-width:\s*100%/s)
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*overflow:\s*hidden/s)
    expect(filmstripCss).toMatch(
      /\.filmstrip-scroll\s*\{[^}]*max-width:\s*100%/s,
    )
    expect(filmstripCss).toMatch(/\.filmstrip-scroll\s*\{[^}]*min-width:\s*0/s)
  })

  it('absolutely packs items from each card end (not max-width slots)', () => {
    expect(filmstripCss).toMatch(
      /\.filmstrip-item\s*\{[^}]*position:\s*absolute/s,
    )
  })
})

describe('Filmstrip aspect cards', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
  })

  it('renders distinct widths for landscape, portrait, and square', () => {
    seedMixedAspectGallery()
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    expect(items).toHaveLength(3)
    expect(items[0]?.getAttribute('data-orientation')).toBe('landscape')
    expect(items[1]?.getAttribute('data-orientation')).toBe('portrait')
    expect(items[2]?.getAttribute('data-orientation')).toBe('square')

    const landW = thumbSlotSize(1.5).width
    const portW = thumbSlotSize(0.5).width
    const squareW = thumbSlotSize(1).width
    expect(items[0]?.style.width).toBe(`${String(landW)}px`)
    expect(items[1]?.style.width).toBe(`${String(portW)}px`)
    expect(items[2]?.style.width).toBe(`${String(squareW)}px`)
    expect(portW).toBeLessThan(landW)

    // Origins follow each card's end + gap — not a fixed max-width stride.
    expect(items[0]?.getAttribute('data-offset-left')).toBe('0')
    expect(items[1]?.getAttribute('data-offset-left')).toBe(
      String(thumbStride(1.5)),
    )
    expect(items[2]?.getAttribute('data-offset-left')).toBe(
      String(thumbStride(1.5) + thumbStride(0.5)),
    )
    expect(items[1]?.style.left).toBe(`${String(thumbStride(1.5))}px`)
    expect(items[2]?.style.left).toBe(
      `${String(thumbStride(1.5) + thumbStride(0.5))}px`,
    )
  })

  it('shows gallery count on the status strip', () => {
    seedGallery(3)
    render(<Filmstrip />)
    expect(screen.getByTestId('filmstrip-count').textContent).toBe('3 photos')
  })

  it('shows import progress on the status strip', () => {
    seedGallery(1)
    render(
      <Filmstrip
        progress={{
          total: 10,
          completed: 3,
          errors: [],
          running: true,
        }}
      />,
    )
    expect(screen.getByTestId('import-progress').textContent).toMatch(
      /Importing 3 \/ 10/,
    )
  })

  it('keeps empty-state copy full-width (not a 1px virtualizer window)', () => {
    resetBookStore()
    render(<Filmstrip />)

    const empty = screen.getByTestId('filmstrip-empty')
    expect(empty.textContent).toMatch(/Add a folder or photos/)
    // Bug: empty lived inside width:1px window → one word per line.
    expect(document.querySelector('.filmstrip-window')).toBeNull()
    expect(empty.parentElement?.getAttribute('data-testid')).toBe(
      'filmstrip-scroll',
    )
    expect(filmstripCss).toMatch(/\.filmstrip-empty\s*\{[^}]*width:\s*100%/s)
  })

  it('mounts enough portrait items to cover a wide scrollport', () => {
    const restore = stubScrollportWidth(1200)
    try {
      seedGallery(40, 0.5)
      render(<Filmstrip />)

      const aspects = Array.from({ length: 40 }, () => 0.5)
      const prefix = buildStridePrefix(aspects)
      const coverPx = 1200 + THUMB_WIDTH_MAX * 2
      const expected = windowCountForCover(prefix, 0, coverPx)
      expect(expected).toBeGreaterThan(16)

      const windowEl = screen.getByTestId('filmstrip-window')
      expect(Number(windowEl.getAttribute('data-window-count'))).toBe(expected)
      expect(screen.getAllByTestId('filmstrip-item')).toHaveLength(expected)
    } finally {
      restore()
    }
  })

  it('keeps the sliding window covering the scrollport after scroll', () => {
    const restore = stubScrollportWidth(1000)
    const callbacks: FrameRequestCallback[] = []
    const previousRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      callbacks.push(cb)
      return callbacks.length
    }

    try {
      seedGallery(50, 0.5)
      render(<Filmstrip />)

      const scroll = screen.getByTestId('filmstrip-scroll')
      const prefix = buildStridePrefix(Array.from({ length: 50 }, () => 0.5))
      const scrollLeft = prefix[12] ?? 0

      act(() => {
        Object.defineProperty(scroll, 'scrollLeft', {
          configurable: true,
          value: scrollLeft,
          writable: true,
        })
        scroll.dispatchEvent(new Event('scroll'))
        for (const cb of callbacks.splice(0, callbacks.length)) {
          cb(0)
        }
      })

      const windowStart = indexFromScrollOffset(scrollLeft, prefix)
      const coverPx = 1000 + THUMB_WIDTH_MAX * 2
      const expected = windowCountForCover(prefix, windowStart, coverPx)
      expect(expected).toBeGreaterThan(16)
      expect(
        Number(
          screen
            .getByTestId('filmstrip-window')
            .getAttribute('data-window-count'),
        ),
      ).toBe(expected)
    } finally {
      globalThis.requestAnimationFrame = previousRaf
      restore()
    }
  })
})

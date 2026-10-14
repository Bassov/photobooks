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
import { spacerWidthPx, thumbSlotSize } from './thumbSlotSize'

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

  it('packs variable-width items with flex gap from each card end', () => {
    // Regresses Virtualizer estimatedRowSize packing (max-width slots + leftover gap).
    expect(filmstripCss).toMatch(/\.filmstrip-list\s*\{[^}]*display:\s*flex/s)
    expect(filmstripCss).toMatch(/\.filmstrip-list\s*\{[^}]*gap:\s*8px/s)
    expect(filmstripCss).toMatch(
      /\.filmstrip-item\s*\{[^}]*flex:\s*0\s+0\s+auto/s,
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
    const callbacks: FrameRequestCallback[] = []
    const previousRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      callbacks.push(cb)
      return callbacks.length
    }

    seedMixedAspectGallery()
    render(<Filmstrip />)
    for (let i = 0; i < 12; i += 1) {
      act(() => {
        const batch = callbacks.splice(0, callbacks.length)
        for (const cb of batch) {
          cb(0)
        }
      })
    }

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

    globalThis.requestAnimationFrame = previousRaf
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
})

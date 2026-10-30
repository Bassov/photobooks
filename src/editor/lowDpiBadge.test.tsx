import { cleanup, render, screen } from '@testing-library/react'
import { setDpiView } from './dpiView'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getSpreadPaintSnapshot,
  resetBookStore,
  setAssetSessionMeta,
  type AssetSessionMeta,
} from './bookStore'
import { PresentationMode } from './PresentationMode'

// A 254 mm (10 in) square frame: N source pixels across = N / 10 dpi.
function bookWith(asset: Book['assets'][string]): Book {
  return makeBook({
    assets: { a: asset },
    gallery: ['a'],
    spreads: [
      makeSpread({
        id: 's0',
        frames: [
          makeFrame({
            rect: { x: 0, y: 0, width: 254, height: 254 },
            assetId: 'a',
          }),
        ],
      }),
    ],
  })
}

function meta(
  correctedWidth: number,
  correctedHeight: number,
): AssetSessionMeta {
  return {
    name: 'a',
    correctedWidth,
    correctedHeight,
    orientation: 1,
    aspect: 1,
  }
}

function load(asset: Book['assets'][string], sessionMeta?: AssetSessionMeta) {
  resetBookStore({
    book: bookWith(asset),
    sessionMeta: new Map(sessionMeta === undefined ? [] : [['a', sessionMeta]]),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const lowDpi = () => getSpreadPaintSnapshot('s0')?.resolved.items[0]?.lowDpi

describe('low-dpi from the paint snapshot', () => {
  beforeEach(() => {
    // Session-meta publishes are rAF-paced; flush synchronously.
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    vi.unstubAllGlobals()
  })

  it('uses decoded session dimensions', () => {
    load({}, meta(1000, 1000))
    expect(lowDpi()).toEqual({ dpi: 100, level: 'min' })
  })

  it('treats only the 1×1 enqueue placeholder as unknown', () => {
    load({}, meta(1, 1))
    expect(lowDpi()).toBeUndefined()
    load({}, meta(1000, 1))
    expect(lowDpi()).toBeDefined()
    load({}, meta(1, 1000))
    expect(lowDpi()).toBeDefined()
  })

  it('falls back to the asset record when session dims are unknown', () => {
    load({ widthPx: 1000, heightPx: 1000 })
    expect(lowDpi()).toEqual({ dpi: 100, level: 'min' })
    load({ widthPx: 1000, heightPx: 1000 }, meta(1, 1))
    expect(lowDpi()).toEqual({ dpi: 100, level: 'min' })
  })

  it('prefers session dims over the asset record', () => {
    load({ widthPx: 1000, heightPx: 1000 }, meta(5000, 5000))
    expect(lowDpi()).toBeUndefined()
  })

  it('repaints when decoded dimensions arrive or change', () => {
    load({}, meta(1, 1))
    expect(lowDpi()).toBeUndefined()
    setAssetSessionMeta('a', meta(1000, 1000))
    expect(lowDpi()).toEqual({ dpi: 100, level: 'min' })
    setAssetSessionMeta('a', meta(1900, 1900))
    expect(lowDpi()).toEqual({ dpi: 190, level: 'warn' })
  })

  it('repaints when only the width of the asset record changes', () => {
    load({ widthPx: 1000, heightPx: 1000 })
    expect(lowDpi()?.dpi).toBe(100)
    resetBookStore({
      book: bookWith({ widthPx: 1500, heightPx: 1000 }),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    expect(lowDpi()?.dpi).toBe(150)
  })
})

describe('badge in the editor and Preview', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    setDpiView(false)
  })

  it('is hidden by default and paints once the DPI view is on', () => {
    load({}, meta(1000, 1000))
    render(<ConnectedSpreadView spreadId="s0" />)
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
    cleanup()
    setDpiView(true)
    render(<ConnectedSpreadView spreadId="s0" />)
    expect(screen.getByTestId('dpi-badge').textContent).toBe('100 dpi')
    cleanup()
    render(<ConnectedSpreadView spreadId="s0" lowDpiBadge={false} />)
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
  })

  it('does not paint in Preview', () => {
    load({}, meta(1000, 1000))
    render(<PresentationMode onExit={() => undefined} />)
    expect(screen.getByTestId('presentation')).toBeTruthy()
    expect(screen.queryByTestId('dpi-badge')).toBeNull()
  })
})

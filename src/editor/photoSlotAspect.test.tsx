import assert from 'node:assert/strict'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExifOrientation } from '../photo/types'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SpreadView } from '../render/SpreadView'
import {
  dispatchBookOp,
  getSpreadPaintSnapshot,
  resetBookStore,
  type AssetSessionMeta,
} from './bookStore'
import {
  getDisplayedPreview,
  queueTierSwap,
  resetTierDisplay,
  setSpreadTiers,
} from './tierDisplay'

/** Decoded (upright) tier bitmaps: thumb 320 and preview 1280. */
const NATURAL: Readonly<Record<string, readonly [number, number]>> = {
  'blob:portrait-320': [213, 320],
  'blob:portrait-1280': [853, 1280],
  // EXIF 6: a 4:3 sensor frame turned upright by the worker.
  'blob:rotated-320': [240, 320],
  'blob:rotated-1280': [960, 1280],
}

const FRAMES = {
  landscape: { x: 10, y: 10, width: 120, height: 80 },
  portrait: { x: 10, y: 10, width: 60, height: 90 },
} as const

/** Session meta before thumb hydrate / decode restores the real size. */
function placeholder(orientation: ExifOrientation): AssetSessionMeta {
  return {
    name: 'photo.jpg',
    correctedWidth: 1,
    correctedHeight: 1,
    orientation,
    aspect: 1,
  }
}

function loadBook(frame: keyof typeof FRAMES, assetId: string): void {
  const book = makeBook({
    gallery: ['portrait', 'rotated'],
    assets: { portrait: {}, rotated: {} },
    spreads: [
      makeSpread({
        id: 's0',
        frames: [makeFrame({ id: 'f0', rect: FRAMES[frame], assetId })],
      }),
    ],
  })
  resetBookStore({
    book,
    sessionMeta: new Map([
      ['portrait', placeholder(1)],
      ['rotated', placeholder(6)],
    ]),
    importRunning: false,
    importExpectedCount: 0,
  })
}

async function showTier(assetId: string, tier: number): Promise<void> {
  const url = `blob:${assetId}-${String(tier)}`
  queueTierSwap(assetId, tier, url)
  await vi.waitFor(() => {
    expect(getDisplayedPreview(assetId)).toBe(url)
  })
}

/** Painted image box aspect over the bitmap aspect (1 = not stretched). */
function paintedStretch(): number {
  const snapshot = getSpreadPaintSnapshot('s0')
  assert(snapshot !== undefined, 'expected a paint snapshot')
  const { container, unmount } = render(
    <SpreadView
      spreadId="s0"
      resolved={snapshot.resolved}
      pxPerMm={1}
      previewUrlFor={getDisplayedPreview}
    />,
  )
  const img = container.querySelector('img')
  const item = snapshot.resolved.items[0]
  assert(img !== null && item !== undefined, 'expected a painted photo')
  const natural = NATURAL[img.src]
  assert(natural !== undefined, `unknown bitmap ${img.src}`)
  const boxWidth =
    (item.rectMm.width * Number.parseFloat(img.style.width)) / 100
  const boxHeight =
    (item.rectMm.height * Number.parseFloat(img.style.height)) / 100
  unmount()
  return boxWidth / boxHeight / (natural[0] / natural[1])
}

describe('photo in a frame keeps the source aspect', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.spyOn(
      HTMLImageElement.prototype,
      'naturalWidth',
      'get',
    ).mockImplementation(function (this: HTMLImageElement) {
      return NATURAL[this.src]?.[0] ?? 0
    })
    vi.spyOn(
      HTMLImageElement.prototype,
      'naturalHeight',
      'get',
    ).mockImplementation(function (this: HTMLImageElement) {
      return NATURAL[this.src]?.[1] ?? 0
    })
    setSpreadTiers(
      'test',
      new Map([
        ['portrait', 1280],
        ['rotated', 1280],
      ]),
    )
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    resetTierDisplay()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  for (const frame of ['landscape', 'portrait'] as const) {
    for (const assetId of ['portrait', 'rotated'] as const) {
      it(`${assetId} photo in a ${frame} frame, thumb then preview tier`, async () => {
        loadBook(frame, assetId)

        await showTier(assetId, 320)
        expect(Math.abs(paintedStretch() - 1)).toBeLessThanOrEqual(0.01)

        await showTier(assetId, 1280)
        expect(Math.abs(paintedStretch() - 1)).toBeLessThanOrEqual(0.01)
      })
    }

    it(`replacing the photo in a filled ${frame} frame`, async () => {
      loadBook(frame, 'portrait')
      await showTier('portrait', 1280)

      dispatchBookOp({
        type: 'replace',
        spreadId: 's0',
        frameId: 'f0',
        assetId: 'rotated',
      })
      await showTier('rotated', 1280)

      expect(Math.abs(paintedStretch() - 1)).toBeLessThanOrEqual(0.01)
    })
  }
})

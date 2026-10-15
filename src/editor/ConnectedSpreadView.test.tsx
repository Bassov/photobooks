import { Profiler } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addSpread, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { selectImageTier } from '../photo/imageTiers'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources, retainAssetSource } from '../photo/assetSources'
import { mockWorkerSuccess } from '../photo/photo.test-helpers'
import { resetTierCache } from '../photo/tierCache'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { getCommittedZoom, resetCameraStore } from './cameraStore'
import { getDisplayedPreview, resetTierDisplay } from './tierDisplay'
import {
  dispatchBookOp,
  getSpreadPaintSnapshot,
  resetBookStore,
  subscribeSpread,
} from './bookStore'

function twoSpreadBook() {
  let book = makeBook({
    id: 'two',
    spreads: [],
    gallery: ['a'],
    assets: { a: {} },
  })
  book = addSpread(book, { id: 's0' })
  book = addSpread(book, { id: 's1' })
  const left = book.spreads[0]?.frames[0]
  const right = book.spreads[1]?.frames[0]
  if (left === undefined || right === undefined) {
    throw new Error('expected frames')
  }
  book = placeAsset(book, 's0', left.id, 'a')
  book = placeAsset(book, 's1', right.id, 'a')
  return book
}

describe('per-spread paint subscription', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetTierDisplay()
    resetTierCache()
    resetAssetSources()
    resetAssetPool()
    resetCameraStore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('notifies only the edited spread and keeps the sibling snapshot', () => {
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
      importRunning: false,
      importExpectedCount: 0,
    })
    const siblingBefore = getSpreadPaintSnapshot('s1')
    let siblingNotified = 0
    const unsubscribe = subscribeSpread('s1', () => {
      siblingNotified += 1
    })

    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      throw new Error('expected frame')
    }
    dispatchBookOp({
      type: 'unplace',
      spreadId: 's0',
      frameId,
    })

    expect(siblingNotified).toBe(0)
    expect(getSpreadPaintSnapshot('s1')).toBe(siblingBefore)
    unsubscribe()
  })

  it('refreshes a neighbor when adding a spread changes its page role', () => {
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const before = getSpreadPaintSnapshot('s1')
    expect(before?.resolved.spreadWidthMm).toBe(book.settings.trim.widthMm)
    expect(before?.resolved.pageCuts).toEqual([])

    dispatchBookOp({ type: 'addSpread', id: 's2' })

    const after = getSpreadPaintSnapshot('s1')
    expect(after).not.toBe(before)
    expect(after?.resolved.spreadWidthMm).toBe(book.settings.trim.widthMm * 2)
    expect(after?.resolved.pageCuts).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
  })

  it('does not update the sibling painted output when one spread changes', () => {
    const book = twoSpreadBook()
    const renders = mountSiblingPaint(book)
    const frameId = book.spreads[0]?.frames[0]?.id
    if (frameId === undefined) {
      throw new Error('expected frame')
    }
    act(() => {
      dispatchBookOp({
        type: 'unplace',
        spreadId: 's0',
        frameId,
      })
    })

    expect(renders.count).toBe(renders.before)
    expect(screen.getAllByTestId('spread-frame-image')).toHaveLength(1)
  })

  it('does not update the sibling painted output when a template changes', () => {
    const book = twoSpreadBook()
    const renders = mountSiblingPaint(book)
    act(() => {
      dispatchBookOp({
        type: 'applyTemplate',
        spreadId: 's0',
        templateId: '4-grid',
      })
    })

    expect(renders.count).toBe(renders.before)
    expect(screen.getAllByTestId('spread-view')).toHaveLength(2)
  })

  it('keeps the current preview until the next tier has decoded', async () => {
    let releaseDecode: (() => void) | undefined
    const decodeGate = new Promise<void>((resolve) => {
      releaseDecode = resolve
    })
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockImplementation(() => decodeGate)
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:tier')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource(
      'a',
      new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
    )
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
      importRunning: false,
      importExpectedCount: 0,
    })

    render(<ConnectedSpreadView spreadId="s0" />)

    for (let step = 0; step < 8; step += 1) {
      await act(async () => {
        await Promise.resolve()
        const queued = callbacks.splice(0)
        for (const callback of queued) {
          callback(0)
        }
      })
    }

    const image = screen.getByTestId('spread-frame-image')
    expect(image.getAttribute('src')).toBe('data:image/svg+xml,sibling')
    expect(image.hasAttribute('data-tier')).toBe(false)
    expect(decode).toHaveBeenCalled()

    await act(async () => {
      releaseDecode?.()
      await decodeGate
    })
    expect(getDisplayedPreview('a')).toBe('blob:tier')

    const item = getSpreadPaintSnapshot('s0')?.resolved.items.find(
      (candidate) => candidate.assetId === 'a',
    )
    if (item === undefined) {
      throw new Error('expected placed item')
    }
    const edge =
      Math.max(item.rectMm.width, item.rectMm.height) * SPREAD_PX_PER_MM
    const swapped = screen.getByTestId('spread-frame-image')
    expect(swapped.getAttribute('src')).toBe('blob:tier')
    expect(swapped.getAttribute('data-tier')).toBe(
      String(selectImageTier(edge * getCommittedZoom(), 1)),
    )
  })
})

function mountSiblingPaint(book: ReturnType<typeof twoSpreadBook>): {
  count: number
  before: number
} {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
    importRunning: false,
    importExpectedCount: 0,
  })
  const renders = { count: 0, before: 0 }
  function Harness() {
    return (
      <>
        <ConnectedSpreadView spreadId="s0" />
        <Profiler
          id="s1"
          onRender={() => {
            renders.count += 1
          }}
        >
          <ConnectedSpreadView spreadId="s1" />
        </Profiler>
      </>
    )
  }
  render(<Harness />)
  renders.before = renders.count
  return renders
}

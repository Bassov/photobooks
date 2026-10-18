import { Profiler } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addSpread, applyTemplate, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { selectImageTier } from '../photo/imageTiers'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources, retainAssetSource } from '../photo/assetSources'
import { mockWorkerSuccess } from '../photo/photo.test-helpers'
import { resetTierCache } from '../photo/tierCache'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { resetGallerySelection, setSelectedAssetId } from './gallerySelection'
import { getCommittedZoom, resetCameraStore } from './cameraStore'
import {
  getDisplayedPreview,
  queueTierSwap,
  resetTierDisplay,
  setSpreadTiers,
} from './tierDisplay'
import {
  dispatchBookOp,
  getSpreadPaintSnapshot,
  resetBookStore,
  subscribeSpread,
} from './bookStore'
import { resetThumbCache, setThumbUrl } from './thumbCache'

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
    resetThumbCache()
    resetAssetSources()
    resetAssetPool()
    resetCameraStore()
    resetFrameSelection()
    resetGallerySelection()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing for a missing spread', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const { container } = render(<ConnectedSpreadView spreadId="missing" />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('spread-view')).toBeNull()
  })

  it('falls back to the filmstrip thumb when tier and preview URLs are missing', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb-fallback')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setThumbUrl('a', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')
    render(<ConnectedSpreadView spreadId="s0" />)
    const image = screen.getByTestId('spread-frame-image')
    expect(image.getAttribute('src')).toBe('blob:thumb-fallback')
  })

  it('updates the frame when a filmstrip thumb publishes after first paint', () => {
    let thumbSerial = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      thumbSerial += 1
      return `blob:thumb-late-${String(thumbSerial)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    const serialBefore = thumbSerial

    act(() => {
      setThumbUrl('a', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')
    })
    expect(thumbSerial).toBeGreaterThan(serialBefore)
    expect(screen.getByTestId('spread-frame-image').getAttribute('src')).toBe(
      `blob:thumb-late-${String(thumbSerial)}`,
    )
  })

  it('does not re-render a spread when an unrelated asset thumb publishes', () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:thumb-${String(Math.random())}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const book = twoSpreadBook()
    const renders = mountSiblingPaint(book)

    act(() => {
      setThumbUrl('other', new Uint8Array([9]).buffer, 'image/jpeg')
    })

    expect(renders.count).toBe(renders.before)
    expect(renders.selfCount).toBe(renders.selfBefore)
  })

  it('does not re-render a spread when an unrelated asset tier displays', async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockResolvedValue(undefined)
    const book = twoSpreadBook()
    const renders = mountSiblingPaint(book)

    await act(async () => {
      setSpreadTiers('ghost', new Map([['other', 320]]))
      queueTierSwap('other', 320, 'blob:other-tier')
      await Promise.resolve()
    })

    expect(decode).toHaveBeenCalled()
    expect(renders.count).toBe(renders.before)
    expect(renders.selfCount).toBe(renders.selfBefore)
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

  it('re-renders a spread for selection only when its labels change', () => {
    let book = twoSpreadBook()
    book = applyTemplate(book, 's0', '4-grid')
    const otherFrames = book.spreads[0]?.frames
    const ownFrame = book.spreads[1]?.frames[0]?.id
    const sourceFrame = otherFrames?.[0]?.id
    const nextFrame = otherFrames?.[1]?.id
    if (
      sourceFrame === undefined ||
      nextFrame === undefined ||
      ownFrame === undefined
    ) {
      throw new Error('expected frames')
    }
    const renders = mountSiblingPaint(book)

    act(() => {
      setSelectedAssetId('a')
    })
    expect(renders.selfCount).toBeGreaterThan(renders.selfBefore)
    expect(renders.count).toBeGreaterThan(renders.before)
    const selected = { self: renders.selfCount, sibling: renders.count }

    act(() => {
      setSelectedAssetId('b')
    })
    expect(renders.selfCount).toBe(selected.self)
    expect(renders.count).toBe(selected.sibling)
    expect(
      screen.getAllByRole('button', { name: 'Replace photo' }),
    ).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Place photo' })).toHaveLength(
      3,
    )

    act(() => {
      setSelectedAssetId(null)
    })
    expect(renders.selfCount).toBeGreaterThan(selected.self)
    expect(renders.count).toBeGreaterThan(selected.sibling)
    const cleared = renders.count

    act(() => {
      setFrameSource({ spreadId: 's0', frameId: sourceFrame })
    })
    expect(renders.count).toBeGreaterThan(cleared)
    const sourced = renders.count
    expect(screen.getByRole('button', { name: 'Cancel move' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Swap photos' })).toHaveLength(
      1,
    )
    expect(
      screen.getAllByRole('button', { name: 'Move photo here' }),
    ).toHaveLength(3)

    act(() => {
      setFrameSource({ spreadId: 's0', frameId: nextFrame })
    })
    expect(renders.count).toBe(sourced)

    act(() => {
      setFrameSource({ spreadId: 's1', frameId: ownFrame })
    })
    expect(renders.count).toBeGreaterThan(sourced)
    const moved = renders.count
    expect(screen.getByRole('button', { name: 'Cancel move' })).toBeTruthy()

    act(() => {
      setFrameSource(null)
    })
    expect(renders.count).toBeGreaterThan(moved)
  })
})

function mountSiblingPaint(book: ReturnType<typeof twoSpreadBook>): {
  count: number
  before: number
  selfCount: number
  selfBefore: number
} {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls: new Map([['a', 'data:image/svg+xml,sibling']]),
    importRunning: false,
    importExpectedCount: 0,
  })
  const renders = { count: 0, before: 0, selfCount: 0, selfBefore: 0 }
  function Harness() {
    return (
      <>
        <Profiler
          id="s0"
          onRender={() => {
            renders.selfCount += 1
          }}
        >
          <ConnectedSpreadView spreadId="s0" />
        </Profiler>
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
  renders.selfBefore = renders.selfCount
  return renders
}

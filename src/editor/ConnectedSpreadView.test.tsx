import { Profiler } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSpread, applyTemplate, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { selectImageTier } from '../photo/imageTiers'
import * as assetPool from '../photo/assetPool'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources, retainAssetSource } from '../photo/assetSources'
import { mockWorkerSuccess } from '../photo/photo.test-helpers'
import * as tierCache from '../photo/tierCache'
import { resetTierCache } from '../photo/tierCache'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'
import {
  getEditorStatus,
  setEditorStatus,
  STATUS_FRAME_DRAG,
  STATUS_SWAPPED,
} from './editorStatus'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { resetGallerySelection, setSelectedAssetId } from './gallerySelection'
import { resetCameraStore } from './cameraStore'
import assert from 'node:assert/strict'
import {
  getDisplayedPreview,
  queueTierSwap,
  resetTierDisplay,
  setSpreadTiers,
} from './tierDisplay'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
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
  assert(left !== undefined && right !== undefined, 'expected frames')
  book = placeAsset(book, 's0', left.id, 'a')
  book = placeAsset(book, 's1', right.id, 'a')
  return book
}

/** Distinct photos on s0/s1 — Done-when isolation for per-spread thumbs. */
function twoSpreadDistinctBook() {
  let book = makeBook({
    id: 'two-distinct',
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

describe('per-spread paint subscription', () => {
  beforeEach(() => {
    // Thumb publishes are rAF-paced; flush sync unless a test queues rAF itself.
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
    exitCropMode()
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

  it('tags the cropped frame with its committed zoom', () => {
    const base = twoSpreadBook()
    const book = {
      ...base,
      spreads: base.spreads.map((spread) => ({
        ...spread,
        frames: spread.frames.map((frame) =>
          frame.assetId === undefined
            ? frame
            : { ...frame, crop: { zoom: 2.5, center: { x: 0.5, y: 0.5 } } },
        ),
      })),
    }
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    const frameId =
      screen.getByTestId('spread-frame').getAttribute('data-frame-id') ?? ''
    expect(screen.queryByTestId('crop-overlay-tag')).toBeNull()
    act(() => {
      enterCropMode('s0', frameId)
    })
    expect(screen.getByTestId('crop-overlay-tag').textContent).toBe(
      'Crop · 250%',
    )
  })

  it('tags an uncropped frame at 100%', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    const frameId =
      screen.getByTestId('spread-frame').getAttribute('data-frame-id') ?? ''
    act(() => {
      enterCropMode('s0', frameId)
    })
    expect(screen.getByTestId('crop-overlay-tag').textContent).toBe(
      'Crop · 100%',
    )
  })

  it('enters crop mode on double-click of a filled frame only', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    const frame = screen.getByTestId('spread-frame')
    expect(frame.getAttribute('data-crop-active')).toBeNull()
    const frameId = frame.getAttribute('data-frame-id') ?? ''
    act(() => {
      setFrameSource({ spreadId: 's0', frameId })
    })
    fireEvent.doubleClick(frame)
    expect(getCropTarget()).toMatchObject({ spreadId: 's0', frameId })
    expect(getFrameSource()).toBeNull()
    expect(frame.getAttribute('data-crop-active')).toBe('true')
    act(() => {
      exitCropMode()
    })
    expect(frame.getAttribute('data-crop-active')).toBeNull()
  })

  it('dims the dragged frame after dragstart and restores it at dragend', () => {
    vi.useFakeTimers()
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    const frame = screen.getByTestId('spread-frame')
    const body = frame.querySelector('.spread-frame-body')
    assert(body !== null)
    fireEvent.dragStart(body, { dataTransfer: new DataTransfer() })
    expect(frame.getAttribute('data-drag-source')).toBeNull()
    act(() => {
      vi.runAllTimers()
    })
    expect(frame.getAttribute('data-drag-source')).toBe('true')
    fireEvent.dragEnd(document)
    expect(frame.getAttribute('data-drag-source')).toBeNull()
    vi.useRealTimers()
  })

  it('shows the kit drag hint from dragstart and clears it at dragend only', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setEditorStatus('')
    render(<ConnectedSpreadView spreadId="s0" />)
    const body = screen
      .getByTestId('spread-frame')
      .querySelector('.spread-frame-body')
    assert(body !== null)

    fireEvent.dragStart(body, { dataTransfer: new DataTransfer() })
    expect(getEditorStatus()).toBe(STATUS_FRAME_DRAG)
    fireEvent.dragEnd(document)
    expect(getEditorStatus()).toBe('')

    // A drop result set before dragend survives it.
    fireEvent.dragStart(body, { dataTransfer: new DataTransfer() })
    setEditorStatus(STATUS_SWAPPED)
    fireEvent.dragEnd(document)
    expect(getEditorStatus()).toBe(STATUS_SWAPPED)

    // The dragend listener is one-shot.
    setEditorStatus(STATUS_FRAME_DRAG)
    fireEvent.dragEnd(document)
    expect(getEditorStatus()).toBe(STATUS_FRAME_DRAG)
    setEditorStatus('')
  })

  it('keeps other spreads out of crop mode', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s1" />)
    const frame = screen.getByTestId('spread-frame')
    const other = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id ?? ''
    act(() => {
      enterCropMode('s0', other)
    })
    expect(frame.getAttribute('data-crop-active')).toBeNull()
    act(() => {
      exitCropMode()
    })
  })

  it('renders nothing for a missing spread', () => {
    resetBookStore({
      book: twoSpreadBook(),
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const visible = vi.spyOn(assetPool, 'setSpreadVisibleAssetIds')
    const { container } = render(<ConnectedSpreadView spreadId="missing" />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('spread-view')).toBeNull()
    expect(visible).toHaveBeenCalledWith('missing', [])
  })

  it('registers spread asset ids for decode priority and clears on unmount', () => {
    const visible = vi.spyOn(assetPool, 'setSpreadVisibleAssetIds')
    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const view = render(<ConnectedSpreadView spreadId="s0" />)
    expect(visible).toHaveBeenCalledWith('s0', ['a'])
    view.unmount()
    expect(visible).toHaveBeenCalledWith('s0', [])
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

  it('shows the filmstrip thumb while the working preview is still loading', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb-while-load')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(tierCache, 'getTierUrl').mockReturnValue(undefined)
    const requestTier = vi
      .spyOn(tierCache, 'requestTier')
      .mockImplementation(() => undefined)
    vi.spyOn(tierCache, 'subscribeTier').mockImplementation(
      () => () => undefined,
    )

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
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const image = screen.getByTestId('spread-frame-image')
    expect(image.getAttribute('src')).toBe('blob:thumb-while-load')
    expect(requestTier).toHaveBeenCalledWith('a', 1280, undefined)
  })

  it('keeps the filmstrip thumb across remount while working preview is still loading', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb-remount')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(tierCache, 'getTierUrl').mockReturnValue(undefined)
    vi.spyOn(tierCache, 'requestTier').mockImplementation(() => undefined)
    vi.spyOn(tierCache, 'subscribeTier').mockImplementation(
      () => () => undefined,
    )

    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setThumbUrl('a', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')

    const first = render(<ConnectedSpreadView spreadId="s0" />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByTestId('spread-frame-image').getAttribute('src')).toBe(
      'blob:thumb-remount',
    )
    first.unmount()

    render(<ConnectedSpreadView spreadId="s0" />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const image = screen.getByTestId('spread-frame-image')
    expect(image.getAttribute('src')).toBe('blob:thumb-remount')
  })

  it('drops a stale displayed tier on remount and falls back to the thumb', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb-after-stale')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(tierCache, 'getTierUrl').mockReturnValue(undefined)
    vi.spyOn(tierCache, 'requestTier').mockImplementation(() => undefined)
    vi.spyOn(tierCache, 'subscribeTier').mockImplementation(
      () => () => undefined,
    )

    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:revoked')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getDisplayedPreview('a')).toBe('blob:revoked')

    const book = twoSpreadBook()
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setThumbUrl('a', new Uint8Array([9]).buffer, 'image/jpeg')

    render(<ConnectedSpreadView spreadId="s0" />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getDisplayedPreview('a')).toBeUndefined()
    expect(screen.getByTestId('spread-frame-image').getAttribute('src')).toBe(
      'blob:thumb-after-stale',
    )
  })

  it('keeps an empty frame as a placeholder with no preview image', () => {
    let book = makeBook({
      id: 'empty-frame',
      spreads: [],
      gallery: [],
      assets: {},
    })
    book = addSpread(book, { id: 's0' })
    resetBookStore({
      book,
      sessionMeta: new Map(),
      previewUrls: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<ConnectedSpreadView spreadId="s0" />)
    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('spread-frame-image')).toBeNull()
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

  it('does not re-render spread B when a thumb publishes for a photo on spread A only', () => {
    let thumbSerial = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      thumbSerial += 1
      return `blob:thumb-a-${String(thumbSerial)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const book = twoSpreadDistinctBook()
    const renders = mountSiblingPaint(book, { previewUrls: new Map() })
    const [spreadA, spreadB] = screen.getAllByTestId('spread-view')
    assert(spreadA !== undefined && spreadB !== undefined, 'expected spreads')
    expect(
      spreadA.querySelector('[data-testid="spread-frame-image"]'),
    ).toBeNull()
    expect(
      spreadB.querySelector('[data-testid="spread-frame-placeholder"]'),
    ).toBeTruthy()

    act(() => {
      setThumbUrl('a', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')
    })

    expect(renders.count).toBe(renders.before)
    expect(renders.selfCount).toBeGreaterThan(renders.selfBefore)
    expect(
      spreadA
        .querySelector('[data-testid="spread-frame-image"]')
        ?.getAttribute('src'),
    ).toBe(`blob:thumb-a-${String(thumbSerial)}`)
    expect(
      spreadB.querySelector('[data-testid="spread-frame-image"]'),
    ).toBeNull()
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
    assert(frameId !== undefined, 'expected frame')
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
    assert(frameId !== undefined, 'expected frame')
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

    const swapped = screen.getByTestId('spread-frame-image')
    expect(swapped.getAttribute('src')).toBe('blob:tier')
    expect(swapped.getAttribute('data-tier')).toBe(String(selectImageTier()))
  })

  it('re-renders a spread for selection only when its labels change', () => {
    let book = twoSpreadBook()
    book = applyTemplate(book, 's0', '4-grid')
    const otherFrames = book.spreads[0]?.frames
    const ownFrame = book.spreads[1]?.frames[0]?.id
    const sourceFrame = otherFrames?.[0]?.id
    const nextFrame = otherFrames?.[1]?.id
    assert(
      sourceFrame !== undefined &&
        nextFrame !== undefined &&
        ownFrame !== undefined,
      'expected frames',
    )
    const renders = mountSiblingPaint(book)

    // Gallery selection no longer changes frame labels (drag place/replace only).
    act(() => {
      setSelectedAssetId('a')
    })
    expect(renders.selfCount).toBe(renders.selfBefore)
    expect(renders.count).toBe(renders.before)
    expect(screen.queryByRole('button', { name: 'Replace photo' })).toBeNull()

    act(() => {
      setSelectedAssetId('b')
    })
    expect(renders.selfCount).toBe(renders.selfBefore)
    expect(renders.count).toBe(renders.before)

    act(() => {
      setSelectedAssetId(null)
    })
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

  it('keeps move wording off while an empty frame is selected', () => {
    let book = twoSpreadBook()
    book = applyTemplate(book, 's0', '4-grid')
    // The template keeps the photo in the first frame; the second is empty.
    const sourceFrame = book.spreads[0]?.frames[1]?.id
    assert(sourceFrame !== undefined, 'expected a frame')
    mountSiblingPaint(book)

    act(() => {
      setFrameSource({ spreadId: 's0', frameId: sourceFrame })
    })
    // Empty selected frame: no swap / move wording on its own spread.
    const spreadEl = document.querySelector<HTMLElement>(
      '[data-testid="spread-view"][data-spread-id="s0"]',
    )
    assert(spreadEl !== null, 'expected the spread')
    const spread = within(spreadEl)
    expect(
      spread.queryAllByRole('button', { name: 'Swap photos' }),
    ).toHaveLength(0)
    expect(
      spread.queryAllByRole('button', { name: 'Move photo here' }),
    ).toHaveLength(0)
    expect(spread.getAllByRole('button', { name: 'Place photo' })).toHaveLength(
      3,
    )
    expect(
      spread.getAllByRole('button', { name: 'Select photo to move' }),
    ).toHaveLength(1)
  })
})

function mountSiblingPaint(
  book: ReturnType<typeof twoSpreadBook>,
  options?: { previewUrls?: Map<string, string> },
): {
  count: number
  before: number
  selfCount: number
  selfBefore: number
} {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls:
      options?.previewUrls ?? new Map([['a', 'data:image/svg+xml,sibling']]),
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

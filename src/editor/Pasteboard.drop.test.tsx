import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addToGallery, applyTemplate, placeAsset } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import * as bookStore from './bookStore'
import { resetCameraStore } from './cameraStore'
import { clearDropHover } from './dropHover'
import assert from 'node:assert/strict'
import {
  ASSET_DRAG_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  encodeFrameDrag,
  type DropTarget,
  type FrameDragSource,
} from './dropTargets'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { getEditorStatus, STATUS_SWAPPED } from './editorStatus'
import { Filmstrip } from './Filmstrip'
import {
  dropSpreadsFromBook,
  unplaceSelectedFrame,
  type DropGeometry,
} from './galleryDrop'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'
import { Pasteboard } from './Pasteboard'
import { pasteboardStridePx } from './pasteboardWindow'

function geometryForCurrentBook(): DropGeometry {
  const book = getBookStoreSnapshot().book
  const pxPerMm = SPREAD_PX_PER_MM
  const widest = book.spreads.length >= 2 ? 2 : 1
  return {
    pxPerMm,
    stridePx: pasteboardStridePx(
      book.settings.trim.heightMm * SPREAD_PX_PER_MM,
    ),
    worldWidthPx: book.settings.trim.widthMm * widest * pxPerMm,
  }
}

function fireDragReleaseAfterStart(release: 'pointerdown' | 'keydown'): void {
  if (release === 'pointerdown') {
    fireEvent.pointerDown(document)
  } else {
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
  }
}

function seedGridBook(): void {
  resetCameraStore()
  resetBookStore()
  let book = getBookStoreSnapshot().book
  book = addToGallery(book, ['a', 'b'])
  const spreadId = book.spreads[0]?.id
  assert(spreadId !== undefined, 'expected a spread')
  book = applyTemplate(book, spreadId, '4-grid')
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function targetPoint(target: DropTarget): { x: number; y: number } {
  const geometry = geometryForCurrentBook()
  const index = buildDropIndex({
    spreads: dropSpreadsFromBook(getBookStoreSnapshot().book, geometry),
    pxPerMm: geometry.pxPerMm,
    stridePx: geometry.stridePx,
    worldWidthPx: geometry.worldWidthPx,
  })
  const frame = index.frames.find(
    (item) =>
      item.spreadId === target.spreadId && item.frameId === target.frameId,
  )
  assert(frame !== undefined, `missing ${target.frameId}`)
  return { x: frame.left + 1, y: frame.top + 1 }
}

function firstTargets(): [DropTarget, DropTarget] {
  const geometry = geometryForCurrentBook()
  const index = buildDropIndex({
    spreads: dropSpreadsFromBook(getBookStoreSnapshot().book, geometry),
    pxPerMm: geometry.pxPerMm,
    stridePx: geometry.stridePx,
    worldWidthPx: geometry.worldWidthPx,
  })
  const first = index.frames[0]
  const second = index.frames[1]
  assert(first !== undefined && second !== undefined, 'expected two frames')
  return [first, second]
}

function dragEvent(
  type: string,
  assetId: string,
  point?: { x: number; y: number },
): DragEvent {
  const dataTransfer = new DataTransfer()
  dataTransfer.setData(ASSET_DRAG_MIME, assetId)
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  Object.defineProperty(event, 'clientX', { value: point?.x ?? 0 })
  Object.defineProperty(event, 'clientY', { value: point?.y ?? 0 })
  return event
}

function startDrag(assetId: string): void {
  document.dispatchEvent(dragEvent('dragstart', assetId))
}

function dragOver(
  scroll: HTMLElement,
  assetId: string,
  x: number,
  y: number,
): void {
  scroll.dispatchEvent(dragEvent('dragover', assetId, { x, y }))
}

describe('Pasteboard gallery drop', () => {
  afterEach(() => {
    cleanup()
    clearDropHover()
    resetGallerySelection()
    resetFrameSelection()
    resetBookStore()
    resetCameraStore()
  })

  it('moves drop hover between frames and clears it off a frame', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first, second] = firstTargets()
    startDrag('a')
    const start = targetPoint(first)
    const next = targetPoint(second)

    dragOver(scroll, 'a', start.x, start.y)
    expect(scroll.querySelectorAll('[data-drop-hover="true"]')).toHaveLength(1)
    expect(
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id'),
    ).toBe(first.frameId)

    dragOver(scroll, 'a', next.x, next.y)
    expect(scroll.querySelectorAll('[data-drop-hover="true"]')).toHaveLength(1)
    expect(
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id'),
    ).toBe(second.frameId)

    dragOver(scroll, 'a', -20, -20)
    expect(scroll.querySelector('[data-drop-hover="true"]')).toBeNull()
  })

  it('places on drop and replaces a filled frame', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first] = firstTargets()
    const point = targetPoint(first)
    startDrag('a')
    dragOver(scroll, 'a', point.x, point.y)
    scroll.dispatchEvent(dragEvent('drop', 'a', point))

    const placed = getBookStoreSnapshot().book.spreads[0]?.frames.find(
      (frame) => frame.id === first.frameId,
    )
    expect(placed?.assetId).toBe('a')
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a', 'b'])
    expect(scroll.querySelector('[data-drop-hover="true"]')).toBeNull()

    startDrag('b')
    dragOver(scroll, 'b', point.x, point.y)
    scroll.dispatchEvent(dragEvent('drop', 'b', point))
    const replaced = getBookStoreSnapshot().book.spreads[0]?.frames.find(
      (frame) => frame.id === first.frameId,
    )
    expect(replaced?.assetId).toBe('b')
  })

  it('selects the target frame after a drop (kit canvas.tsx:170-171)', async () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [, second] = firstTargets()
    const point = targetPoint(second)
    expect(getFrameSource()).toBeNull()
    startDrag('a')
    dragOver(scroll, 'a', point.x, point.y)
    scroll.dispatchEvent(dragEvent('drop', 'a', point))
    // Selection lands one task after the drop commit (frame-budget gate).
    await waitFor(() => {
      expect(getFrameSource()).toEqual({
        spreadId: second.spreadId,
        frameId: second.frameId,
      })
    })
  })

  it('selects nothing when the dropped photo is not placed', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first] = firstTargets()
    const point = targetPoint(first)
    startDrag('not-in-gallery')
    dragOver(scroll, 'not-in-gallery', point.x, point.y)
    scroll.dispatchEvent(dragEvent('drop', 'not-in-gallery', point))
    expect(getFrameSource()).toBeNull()
  })

  it('does not edit a frame without a gallery selection', () => {
    seedGridBook()
    const before = getBookStoreSnapshot().book
    render(<Pasteboard />)

    const placeButton = screen.getAllByRole('button', {
      name: 'Place photo',
    })[0]
    assert(placeButton !== undefined, 'expected a place button')
    fireEvent.click(placeButton)

    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('does not place or replace from a frame click when a photo is selected', () => {
    seedGridBook()
    render(<Pasteboard />)
    setSelectedAssetId('a')
    const [first] = firstTargets()
    const button = screen
      .getAllByRole('button', { name: 'Place photo' })
      .find((node) => node.getAttribute('data-frame-id') === first.frameId)
    assert(button !== undefined, 'expected a place button')
    fireEvent.click(button)

    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames.find(
        (frame) => frame.id === first.frameId,
      )?.assetId,
    ).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Replace photo' })).toBeNull()
  })

  it('swaps on a frame drop, moves onto an empty frame, and ignores a self-drop', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const firstId = frames?.[0]?.id
    const secondId = frames?.[1]?.id
    assert(
      spreadId !== undefined && firstId !== undefined && secondId !== undefined,
      'expected two frames',
    )
    let book = placeAsset(getBookStoreSnapshot().book, spreadId, firstId, 'a')
    book = placeAsset(book, spreadId, secondId, 'b')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const source: FrameDragSource = { spreadId, frameId: firstId }
    const [first, second] = firstTargets()
    const point = targetPoint(second)

    document.dispatchEvent(frameDragEvent('dragstart', source))
    scroll.dispatchEvent(frameDragEvent('dragover', source, point))
    expect(
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id'),
    ).toBe(second.frameId)

    scroll.dispatchEvent(frameDragEvent('drop', source, point))
    expect(assetIn(first.frameId)).toBe('b')
    expect(assetIn(second.frameId)).toBe('a')

    const emptyId = frames?.[2]?.id
    assert(emptyId !== undefined, 'expected an empty frame')
    const moved = { spreadId, frameId: second.frameId }
    document.dispatchEvent(frameDragEvent('dragstart', moved))
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        moved,
        targetPoint({ ...second, frameId: emptyId }),
      ),
    )
    expect(assetIn(second.frameId)).toBeUndefined()
    expect(assetIn(emptyId)).toBe('a')

    const self = targetPoint({ ...first, frameId: first.frameId })
    const before = getBookStoreSnapshot().book
    document.dispatchEvent(
      frameDragEvent('dragstart', { spreadId, frameId: first.frameId }),
    )
    scroll.dispatchEvent(
      frameDragEvent('drop', { spreadId, frameId: first.frameId }, self),
    )
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('ignores the click that follows a frame dragstart', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    assert(spreadId !== undefined && frameId !== undefined, 'expected a frame')
    const book = placeAsset(getBookStoreSnapshot().book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    const button = screen.getByRole('button', { name: 'Select photo to move' })
    const body = button.querySelector('.spread-frame-body')
    assert(body instanceof HTMLElement, 'expected a drag body')
    const before = getBookStoreSnapshot().book
    const dataTransfer = new DataTransfer()
    fireEvent.dragStart(body, { dataTransfer })
    fireEvent.click(button)

    expect(getBookStoreSnapshot().book).toBe(before)
    expect(button.getAttribute('aria-pressed')).toBeNull()
  })

  it('selects a filled frame and swaps or moves from the keyboard', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const firstId = frames?.[0]?.id
    const secondId = frames?.[1]?.id
    assert(
      spreadId !== undefined && firstId !== undefined && secondId !== undefined,
      'expected two frames',
    )
    let book = placeAsset(getBookStoreSnapshot().book, spreadId, firstId, 'a')
    book = placeAsset(book, spreadId, secondId, 'b')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)

    const source = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === firstId)
    assert(source !== undefined, 'expected a move source')
    fireEvent.click(source)
    expect(source.getAttribute('aria-pressed')).toBe('true')
    const swap = screen
      .getAllByRole('button', { name: 'Swap photos' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    assert(swap !== undefined, 'expected a swap target')
    fireEvent.click(swap)
    expect(assetIn(firstId)).toBe('b')
    expect(assetIn(secondId)).toBe('a')
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()

    const again = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    assert(again !== undefined, 'expected the swapped source')
    fireEvent.click(again)
    const move = screen.getAllByRole('button', { name: 'Move photo here' })[0]
    assert(move !== undefined, 'expected an empty frame')
    fireEvent.click(move)
    const movedId = move.getAttribute('data-frame-id') ?? ''
    expect(assetIn(secondId)).toBeUndefined()
    expect(assetIn(movedId)).toBe('a')
  })

  it('accepts the next frame click after a move and after a filmstrip drop', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const firstId = frames?.[0]?.id
    const secondId = frames?.[1]?.id
    const emptyId = frames?.[2]?.id
    assert(
      spreadId !== undefined &&
        firstId !== undefined &&
        secondId !== undefined &&
        emptyId !== undefined,
      'expected three frames',
    )
    let book = placeAsset(getBookStoreSnapshot().book, spreadId, firstId, 'a')
    book = placeAsset(book, spreadId, secondId, 'b')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(
      <>
        <Pasteboard />
        <Filmstrip />
      </>,
    )
    const scroll = screen.getByTestId('pasteboard-scroll')
    const source = { spreadId, frameId: firstId }
    const sourceButton = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === firstId)
    const sourceBody = sourceButton?.querySelector('.spread-frame-body')
    assert(sourceBody instanceof HTMLElement, 'expected a drag body')
    fireEvent.dragStart(sourceBody, { dataTransfer: new DataTransfer() })
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        source,
        targetPoint({ ...source, frameId: emptyId, filled: false }),
      ),
    )
    fireEvent.pointerDown(document)
    const remaining = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    assert(remaining !== undefined, 'expected the other filled frame')
    fireEvent.click(remaining)
    expect(remaining.getAttribute('aria-pressed')).toBe('true')

    act(() => {
      setFrameSource(null)
    })
    const again = { spreadId, frameId: secondId }
    const againButton = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    const againBody = againButton?.querySelector('.spread-frame-body')
    assert(againBody instanceof HTMLElement, 'expected the other drag body')
    fireEvent.dragStart(againBody, { dataTransfer: new DataTransfer() })
    const filmstrip = screen.getByTestId('filmstrip-scroll')
    filmstrip.dispatchEvent(frameDragEvent('drop', again))
    fireEvent.pointerDown(document)
    const moved = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === emptyId)
    assert(moved !== undefined, 'expected the moved photo')
    fireEvent.click(moved)
    expect(moved.getAttribute('aria-pressed')).toBe('true')
  })

  it.each(['pointerdown', 'keydown'] as const)(
    'lets a %s after dragstart select the frame',
    (release) => {
      seedGridBook()
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
      assert(
        spreadId !== undefined && frameId !== undefined,
        'expected a frame',
      )
      const book = placeAsset(
        getBookStoreSnapshot().book,
        spreadId,
        frameId,
        'a',
      )
      resetBookStore({
        book,
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
      render(<Pasteboard />)
      const button = screen.getByRole('button', {
        name: 'Select photo to move',
      })
      const body = button.querySelector('.spread-frame-body')
      assert(body instanceof HTMLElement, 'expected a drag body')
      fireEvent.dragStart(body, { dataTransfer: new DataTransfer() })
      fireDragReleaseAfterStart(release)
      fireEvent.click(button)
      expect(button.getAttribute('aria-pressed')).toBe('true')
    },
  )

  it('cancels the move source when that frame is activated again', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    assert(spreadId !== undefined && frameId !== undefined, 'expected a frame')
    const book = placeAsset(getBookStoreSnapshot().book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(
      <>
        <Pasteboard />
        <Filmstrip />
      </>,
    )
    const button = screen.getByRole('button', { name: 'Select photo to move' })
    fireEvent.click(button)
    const pressed = screen.getByRole('button', { name: 'Cancel move' })
    fireEvent.click(pressed)
    expect(getFrameSource()).toBeNull()
    expect(document.querySelector('[aria-pressed="true"]')).toBeNull()
    expect(
      document.querySelector('.filmstrip-unplace')?.hasAttribute('disabled'),
    ).toBe(true)
  })

  it('applies one swap op and leaves an unrelated move source in place', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const firstId = frames?.[0]?.id
    const secondId = frames?.[1]?.id
    const thirdId = frames?.[2]?.id
    assert(
      spreadId !== undefined &&
        firstId !== undefined &&
        secondId !== undefined &&
        thirdId !== undefined,
      'expected three frames',
    )
    let book = placeAsset(getBookStoreSnapshot().book, spreadId, firstId, 'a')
    book = placeAsset(book, spreadId, secondId, 'b')
    book = placeAsset(book, spreadId, thirdId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    setFrameSource({ spreadId, frameId: thirdId })
    const scroll = screen.getByTestId('pasteboard-scroll')
    const source = { spreadId, frameId: firstId }
    const spy = vi.spyOn(bookStore, 'dispatchBookOp')
    document.dispatchEvent(frameDragEvent('dragstart', source))
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        source,
        targetPoint({ spreadId, frameId: secondId, filled: true }),
      ),
    )
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    expect(getEditorStatus()).toBe(STATUS_SWAPPED)
    expect(getFrameSource()).toEqual({ spreadId, frameId: thirdId })
    expect(assetIn(firstId)).toBe('b')
    expect(assetIn(secondId)).toBe('a')

    const draggedSource = { spreadId, frameId: thirdId }
    document.dispatchEvent(frameDragEvent('dragstart', draggedSource))
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        draggedSource,
        targetPoint({ spreadId, frameId: firstId, filled: true }),
      ),
    )
    expect(getFrameSource()).toBeNull()
  })

  it('swaps a frame with the same slot on another spread', () => {
    seedGridBook()
    const book0 = getBookStoreSnapshot().book
    const spreadA = book0.spreads[0]?.id
    const spreadB = book0.spreads[1]?.id
    const frameA = book0.spreads[0]?.frames[0]?.id
    const frameB = book0.spreads[1]?.frames[0]?.id
    assert(
      spreadA !== undefined &&
        spreadB !== undefined &&
        frameA !== undefined &&
        frameB !== undefined,
      'expected two spreads',
    )
    let book = placeAsset(book0, spreadA, frameA, 'a')
    book = placeAsset(book, spreadB, frameB, 'b')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const source = { spreadId: spreadA, frameId: frameA }
    document.dispatchEvent(frameDragEvent('dragstart', source))
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        source,
        targetPoint({ spreadId: spreadB, frameId: frameB, filled: true }),
      ),
    )
    expect(assetIn(frameA)).toBe('b')
    expect(
      getBookStoreSnapshot().book.spreads[1]?.frames.find(
        (frame) => frame.id === frameB,
      )?.assetId,
    ).toBe('a')
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a', 'b'])
  })

  it('ignores a frame drop while a zoom gesture is active', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    const emptyId = getBookStoreSnapshot().book.spreads[0]?.frames[1]?.id
    assert(
      spreadId !== undefined && frameId !== undefined && emptyId !== undefined,
      'expected two frames',
    )
    const book = placeAsset(getBookStoreSnapshot().book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    unplaceSelectedFrame()
    const before = getBookStoreSnapshot().book
    screen.getByTestId('pasteboard-world').dataset.gesture = 'zoom'
    const source = { spreadId, frameId }
    document.dispatchEvent(frameDragEvent('dragstart', source))
    screen
      .getByTestId('pasteboard-scroll')
      .dispatchEvent(
        frameDragEvent(
          'drop',
          source,
          targetPoint({ spreadId, frameId: emptyId, filled: false }),
        ),
      )
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('clears the move source when a gallery photo is selected without click-replace', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    assert(spreadId !== undefined && frameId !== undefined, 'expected a frame')
    const book = placeAsset(getBookStoreSnapshot().book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    act(() => {
      setFrameSource({ spreadId, frameId })
      setSelectedAssetId('b')
    })
    expect(getFrameSource()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Replace photo' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Select photo to move' }),
    )
    expect(assetIn(frameId)).toBe('a')
    expect(getFrameSource()).toEqual({ spreadId, frameId })
  })

  it('uses live filled state on drop when the dragstart snapshot is stale', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first] = firstTargets()
    const point = targetPoint(first)
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    assert(spreadId !== undefined, 'expected a spread')
    const spy = vi.spyOn(bookStore, 'dispatchBookOp')

    startDrag('a')
    scroll.dispatchEvent(dragEvent('drop', 'a', point))
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fillSpread',
        frameId: first.frameId,
        assetIds: ['a'],
      }),
    )
    expect(assetIn(first.frameId)).toBe('a')

    act(() => {
      bookStore.dispatchBookOp({
        type: 'unplace',
        spreadId,
        frameId: first.frameId,
      })
    })
    startDrag('b')
    // Mid-drag: frame fills after the empty dragstart snapshot.
    act(() => {
      bookStore.dispatchBookOp({
        type: 'place',
        spreadId,
        frameId: first.frameId,
        assetId: 'a',
      })
    })
    spy.mockClear()
    scroll.dispatchEvent(dragEvent('drop', 'b', point))
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fillSpread',
        frameId: first.frameId,
        assetIds: ['b'],
      }),
    )
    expect(assetIn(first.frameId)).toBe('b')
    spy.mockRestore()
  })

  it('clears gallery selection when a frame drag starts', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    assert(spreadId !== undefined && frameId !== undefined, 'expected a frame')
    const book = placeAsset(getBookStoreSnapshot().book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    act(() => {
      setSelectedAssetId('b')
    })
    expect(getSelectedAssetId()).toBe('b')
    document.dispatchEvent(frameDragEvent('dragstart', { spreadId, frameId }))
    expect(getSelectedAssetId()).toBeNull()
  })

  it('clears gallery selection on opaque frame MIME dragstart', () => {
    seedGridBook()
    render(<Pasteboard />)
    act(() => {
      setSelectedAssetId('b')
    })
    const opaque = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(opaque, 'dataTransfer', {
      value: {
        types: [FRAME_DRAG_MIME],
        getData: () => '',
        setData: () => undefined,
        effectAllowed: 'move',
        dropEffect: 'none',
      },
    })
    document.dispatchEvent(opaque)
    expect(getSelectedAssetId()).toBeNull()
  })

  it('live filled lookup uses the drop target frame id', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const f1 = frames?.[0]?.id
    const f4 = frames?.[3]?.id
    assert(
      spreadId !== undefined && f1 !== undefined && f4 !== undefined,
      'expected four frames',
    )
    startDrag('b')
    act(() => {
      bookStore.dispatchBookOp({
        type: 'place',
        spreadId,
        frameId: f4,
        assetId: 'a',
      })
    })
    scroll.dispatchEvent(
      dragEvent(
        'drop',
        'b',
        targetPoint({ spreadId, frameId: f4, filled: true }),
      ),
    )
    expect(assetIn(f4)).toBe('b')
    expect(assetIn(f1)).toBeUndefined()
  })

  it('clears the session when an asset dragstart has no asset id', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first] = firstTargets()
    document.dispatchEvent(dragEvent('dragstart', 'a'))
    const emptyAsset = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(emptyAsset, 'dataTransfer', {
      value: {
        types: [ASSET_DRAG_MIME],
        getData: () => '',
        setData: () => undefined,
        effectAllowed: 'copy',
        dropEffect: 'none',
      },
    })
    document.dispatchEvent(emptyAsset)
    scroll.dispatchEvent(dragEvent('drop', 'a', targetPoint(first)))
    expect(assetIn(first.frameId)).toBeUndefined()
  })

  it('does not place after dragend cleared the drop session', () => {
    seedGridBook()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const [first] = firstTargets()
    startDrag('a')
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    scroll.dispatchEvent(dragEvent('drop', 'a', targetPoint(first)))
    expect(assetIn(first.frameId)).toBeUndefined()
  })

  it('clears a stale asset session on an unrelated dragstart', () => {
    seedGridBook()
    let book = addToGallery(getBookStoreSnapshot().book, ['c'])
    const spreadId = book.spreads[0]?.id
    const frameId = book.spreads[0]?.frames[0]?.id
    assert(spreadId !== undefined && frameId !== undefined, 'expected a frame')
    book = placeAsset(book, spreadId, frameId, 'c')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    document.dispatchEvent(dragEvent('dragstart', 'a'))
    const plain = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(plain, 'dataTransfer', {
      value: {
        types: ['text/plain'],
        getData: () => 'x',
        setData: () => undefined,
        effectAllowed: 'copy',
        dropEffect: 'none',
      },
    })
    document.dispatchEvent(plain)
    scroll.dispatchEvent(
      dragEvent('drop', 'a', targetPoint({ spreadId, frameId, filled: true })),
    )
    expect(assetIn(frameId)).toBe('c')
  })

  it('PLC-04: stale asset session cannot replace when frame MIME is unreadable', () => {
    seedGridBook()
    let book = addToGallery(getBookStoreSnapshot().book, ['c', 'd'])
    const spreadId = book.spreads[0]?.id
    const frames = book.spreads[0]?.frames
    const ids = frames?.map((frame) => frame.id) ?? []
    const [f1, f2, f3, f4] = ids
    assert(
      spreadId !== undefined &&
        f1 !== undefined &&
        f2 !== undefined &&
        f3 !== undefined &&
        f4 !== undefined,
      'expected four frames',
    )
    book = placeAsset(book, spreadId, f1, 'a')
    book = placeAsset(book, spreadId, f2, 'b')
    book = placeAsset(book, spreadId, f3, 'c')
    book = placeAsset(book, spreadId, f4, 'd')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(
      <>
        <Pasteboard />
        <Filmstrip />
      </>,
    )
    const scroll = screen.getByTestId('pasteboard-scroll')
    const filmstrip = screen.getByTestId('filmstrip-scroll')

    // Swap → move → drop-on-self (QA sequence before the failing unplace).
    document.dispatchEvent(
      frameDragEvent('dragstart', { spreadId, frameId: f1 }),
    )
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        { spreadId, frameId: f1 },
        targetPoint({ spreadId, frameId: f2, filled: true }),
      ),
    )
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    act(() => {
      bookStore.dispatchBookOp({ type: 'unplace', spreadId, frameId: f4 })
    })
    document.dispatchEvent(
      frameDragEvent('dragstart', { spreadId, frameId: f3 }),
    )
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        { spreadId, frameId: f3 },
        targetPoint({ spreadId, frameId: f4, filled: false }),
      ),
    )
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    document.dispatchEvent(
      frameDragEvent('dragstart', { spreadId, frameId: f4 }),
    )
    scroll.dispatchEvent(
      frameDragEvent(
        'drop',
        { spreadId, frameId: f4 },
        targetPoint({ spreadId, frameId: f4, filled: true }),
      ),
    )
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    expect(assetIn(f1)).toBe('b')
    expect(assetIn(f2)).toBe('a')
    expect(assetIn(f3)).toBeUndefined()
    expect(assetIn(f4)).toBe('c')

    // Mid-import style filmstrip drag left armed; no dragend (source unmounted).
    act(() => {
      setSelectedAssetId('d')
    })
    document.dispatchEvent(dragEvent('dragstart', 'd'))

    // Next frame dragstart cannot read custom MIME (dragstart getData quirk).
    const opaqueFrameStart = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(opaqueFrameStart, 'dataTransfer', {
      value: {
        types: [FRAME_DRAG_MIME],
        getData: () => '',
        setData: () => undefined,
        effectAllowed: 'move',
        dropEffect: 'none',
      },
    })
    document.dispatchEvent(opaqueFrameStart)

    // Drop aimed at filmstrip must unplace f2 only — never replace another
    // frame with the stale asset session's d (PLC-04: d×2 / c lost).
    filmstrip.dispatchEvent(frameDragEvent('drop', { spreadId, frameId: f2 }))
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))

    const placed = [assetIn(f1), assetIn(f2), assetIn(f3), assetIn(f4)]
    expect(assetIn(f2)).toBeUndefined()
    expect(placed.filter((id) => id === 'd')).toHaveLength(0)
    expect(placed.filter((id) => id === 'c')).toHaveLength(1)
    expect(new Set(placed.filter(Boolean)).size).toBe(
      placed.filter(Boolean).length,
    )
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a', 'b', 'c', 'd'])
  })

  it('PLC-04: pasteboard drop after opaque frame start does not apply stale asset', () => {
    seedGridBook()
    let book = addToGallery(getBookStoreSnapshot().book, ['c', 'd'])
    const spreadId = book.spreads[0]?.id
    const frames = book.spreads[0]?.frames
    const f3 = frames?.[2]?.id
    const f4 = frames?.[3]?.id
    assert(
      spreadId !== undefined && f3 !== undefined && f4 !== undefined,
      'expected frames',
    )
    book = placeAsset(book, spreadId, f3, 'c')
    book = placeAsset(book, spreadId, f4, 'd')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')

    document.dispatchEvent(dragEvent('dragstart', 'd'))
    const opaqueFrameStart = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(opaqueFrameStart, 'dataTransfer', {
      value: {
        types: [FRAME_DRAG_MIME],
        getData: () => '',
        setData: () => undefined,
        effectAllowed: 'move',
        dropEffect: 'none',
      },
    })
    document.dispatchEvent(opaqueFrameStart)

    scroll.dispatchEvent(
      dragEvent(
        'drop',
        'd',
        targetPoint({ spreadId, frameId: f3, filled: true }),
      ),
    )
    expect(assetIn(f3)).toBe('c')
    expect(assetIn(f4)).toBe('d')
  })
})

function frameDragEvent(
  type: string,
  source: FrameDragSource,
  point?: { x: number; y: number },
): DragEvent {
  const dataTransfer = new DataTransfer()
  dataTransfer.setData(FRAME_DRAG_MIME, encodeFrameDrag(source))
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  Object.defineProperty(event, 'clientX', { value: point?.x ?? 0 })
  Object.defineProperty(event, 'clientY', { value: point?.y ?? 0 })
  return event
}

function assetIn(frameId: string): string | undefined {
  return getBookStoreSnapshot().book.spreads[0]?.frames.find(
    (frame) => frame.id === frameId,
  )?.assetId
}

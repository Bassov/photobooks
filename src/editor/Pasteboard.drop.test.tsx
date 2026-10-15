import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { addToGallery, applyTemplate, placeAsset } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { clearDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  encodeFrameDrag,
  type DropTarget,
  type FrameDragSource,
} from './dropTargets'
import { resetFrameSelection } from './frameSelection'
import { dropSpreadsFromBook, type DropGeometry } from './galleryDrop'
import { resetGallerySelection, setSelectedAssetId } from './gallerySelection'
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

function seedGridBook(): void {
  resetCameraStore()
  resetBookStore()
  let book = getBookStoreSnapshot().book
  book = addToGallery(book, ['a', 'b'])
  const spreadId = book.spreads[0]?.id
  if (spreadId === undefined) {
    throw new Error('expected a spread')
  }
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
  if (frame === undefined) {
    throw new Error(`missing ${target.frameId}`)
  }
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
  if (first === undefined || second === undefined) {
    throw new Error('expected two frames')
  }
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

  it('does not edit a frame without a gallery selection', () => {
    seedGridBook()
    const before = getBookStoreSnapshot().book
    render(<Pasteboard />)

    const placeButton = screen.getAllByRole('button', {
      name: 'Place photo',
    })[0]
    if (placeButton === undefined) {
      throw new Error('expected a place button')
    }
    fireEvent.click(placeButton)

    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('places and replaces from the frame button when a photo is selected', () => {
    seedGridBook()
    render(<Pasteboard />)
    setSelectedAssetId('a')
    const [first] = firstTargets()
    const button = screen
      .getAllByRole('button', { name: 'Place photo' })
      .find((node) => node.getAttribute('data-frame-id') === first.frameId)
    if (button === undefined) {
      throw new Error('expected a place button')
    }
    fireEvent.click(button)

    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames.find(
        (frame) => frame.id === first.frameId,
      )?.assetId,
    ).toBe('a')

    setSelectedAssetId('b')
    const replace = screen.getByRole('button', { name: 'Replace photo' })
    fireEvent.click(replace)
    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames.find(
        (frame) => frame.id === first.frameId,
      )?.assetId,
    ).toBe('b')
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a', 'b'])
  })

  it('swaps on a frame drop, moves onto an empty frame, and ignores a self-drop', () => {
    seedGridBook()
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frames = getBookStoreSnapshot().book.spreads[0]?.frames
    const firstId = frames?.[0]?.id
    const secondId = frames?.[1]?.id
    if (
      spreadId === undefined ||
      firstId === undefined ||
      secondId === undefined
    ) {
      throw new Error('expected two frames')
    }
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
    if (emptyId === undefined) {
      throw new Error('expected an empty frame')
    }
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
    if (spreadId === undefined || frameId === undefined) {
      throw new Error('expected a frame')
    }
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
    if (!(body instanceof HTMLElement)) {
      throw new Error('expected a drag body')
    }
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
    if (
      spreadId === undefined ||
      firstId === undefined ||
      secondId === undefined
    ) {
      throw new Error('expected two frames')
    }
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
    if (source === undefined) {
      throw new Error('expected a move source')
    }
    fireEvent.click(source)
    expect(source.getAttribute('aria-pressed')).toBe('true')
    const swap = screen
      .getAllByRole('button', { name: 'Swap photos' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    if (swap === undefined) {
      throw new Error('expected a swap target')
    }
    fireEvent.click(swap)
    expect(assetIn(firstId)).toBe('b')
    expect(assetIn(secondId)).toBe('a')
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()

    const again = screen
      .getAllByRole('button', { name: 'Select photo to move' })
      .find((node) => node.getAttribute('data-frame-id') === secondId)
    if (again === undefined) {
      throw new Error('expected the swapped source')
    }
    fireEvent.click(again)
    const move = screen.getAllByRole('button', { name: 'Move photo here' })[0]
    if (move === undefined) {
      throw new Error('expected an empty frame')
    }
    fireEvent.click(move)
    const movedId = move.getAttribute('data-frame-id') ?? ''
    expect(assetIn(secondId)).toBeUndefined()
    expect(assetIn(movedId)).toBe('a')
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

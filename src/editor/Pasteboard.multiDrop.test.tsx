import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import assert from 'node:assert/strict'
import { addToGallery, applyTemplate } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { commitZoom, resetCameraStore } from './cameraStore'
import { clearDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  ASSET_MULTI_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  encodeAssetIds,
  encodeFrameDrag,
} from './dropTargets'
import { getEditorStatus } from './editorStatus'
import { dropSpreadsFromBook, type DropGeometry } from './galleryDrop'
import { resetGallerySelection } from './gallerySelection'
import { Pasteboard } from './Pasteboard'
import { newSpreadPillFits } from './pageLabelsModel'
import { pasteboardGapPx, pasteboardStridePx } from './pasteboardWindow'

const IDS = ['a', 'b', 'c', 'd', 'e']

function geometry(zoom = 1): DropGeometry {
  const book = getBookStoreSnapshot().book
  const pxPerMm = SPREAD_PX_PER_MM * zoom
  return {
    pxPerMm,
    stridePx: pasteboardStridePx(book.settings.trim.heightMm * pxPerMm),
    worldWidthPx:
      book.settings.trim.widthMm * (book.spreads.length >= 2 ? 2 : 1) * pxPerMm,
  }
}

/** Zoom at which the seeded gap holds the new-spread pill (newSpreadPillFits). */
const PILL_ZOOM = 4

function seedAtPillZoom(): void {
  seed()
  commitZoom(PILL_ZOOM, 0, 0)
  const trimHeightPx =
    getBookStoreSnapshot().book.settings.trim.heightMm *
    SPREAD_PX_PER_MM *
    PILL_ZOOM
  assert(newSpreadPillFits(pasteboardGapPx(trimHeightPx)))
}

function seed(): void {
  resetCameraStore()
  resetBookStore()
  let book = addToGallery(getBookStoreSnapshot().book, IDS)
  const first = book.spreads[0]?.id
  assert(first !== undefined, 'expected a spread')
  book = applyTemplate(book, first, '4-grid')
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function dragEvent(
  type: string,
  ids: readonly string[],
  point?: { x: number; y: number },
): DragEvent {
  const dataTransfer = new DataTransfer()
  const [primary] = ids
  assert(primary !== undefined)
  dataTransfer.setData(ASSET_DRAG_MIME, primary)
  if (ids.length > 1) {
    dataTransfer.setData(ASSET_MULTI_MIME, encodeAssetIds(ids))
  }
  const event = new DragEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  Object.defineProperty(event, 'clientX', { value: point?.x ?? 0 })
  Object.defineProperty(event, 'clientY', { value: point?.y ?? 0 })
  return event
}

function firstFramePoint(): { x: number; y: number } {
  const g = geometry()
  const index = buildDropIndex({
    spreads: dropSpreadsFromBook(getBookStoreSnapshot().book, g),
    pxPerMm: g.pxPerMm,
    stridePx: g.stridePx,
    worldWidthPx: g.worldWidthPx,
  })
  const frame = index.frames[0]
  assert(frame !== undefined)
  return { x: frame.left + 1, y: frame.top + 1 }
}

function assets(): (string | undefined)[] {
  return (getBookStoreSnapshot().book.spreads[0]?.frames ?? []).map(
    (frame) => frame.assetId,
  )
}

describe('Pasteboard multi-photo drop', () => {
  afterEach(() => {
    cleanup()
    clearDropHover()
    resetGallerySelection()
    resetBookStore()
    resetCameraStore()
  })

  it('fills the empty frames in gallery order, whatever order ids are carried in', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const point = firstFramePoint()
    const carried = ['c', 'a', 'd', 'b']
    document.dispatchEvent(dragEvent('dragstart', carried))
    scroll.dispatchEvent(dragEvent('dragover', carried, point))
    scroll.dispatchEvent(dragEvent('drop', carried, point))
    expect(assets()).toEqual(['a', 'b', 'c', 'd'])
    expect(getEditorStatus()).toBe('')
    undoBook()
    expect(assets()).toEqual([undefined, undefined, undefined, undefined])
  })

  it('reports photos left over and ignores unknown ids', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const point = firstFramePoint()
    const carried = ['a', 'b', 'c', 'd', 'e', 'ghost']
    document.dispatchEvent(dragEvent('dragstart', carried))
    scroll.dispatchEvent(dragEvent('drop', carried, point))
    expect(assets()).toEqual(['a', 'b', 'c', 'd'])
    expect(getEditorStatus()).toBe('1 photo left in the filmstrip')
  })

  it('inserts a new spread when dropped in the gap under a spread (one undo step)', () => {
    seedAtPillZoom()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const y = geometry(PILL_ZOOM).stridePx - 4
    const count = getBookStoreSnapshot().book.spreads.length
    const carried = ['a', 'b']
    document.dispatchEvent(dragEvent('dragstart', carried))
    expect(scroll.dataset.assetDrag).toBe('true')
    scroll.dispatchEvent(dragEvent('dragover', carried, { x: 5, y }))
    expect(
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-gap-insert-index'),
    ).toBe('1')
    scroll.dispatchEvent(dragEvent('drop', carried, { x: 5, y }))
    const book = getBookStoreSnapshot().book
    expect(book.spreads).toHaveLength(count + 1)
    expect(
      book.spreads[1]?.frames.map((frame) => frame.assetId).slice(0, 2),
    ).toEqual(['a', 'b'])
    expect(scroll.dataset.assetDrag).toBeUndefined()
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(count)
  })

  it('renders one labelled, hidden-from-AT gap zone per spread with its insert index', () => {
    seedAtPillZoom()
    render(<Pasteboard />)
    const zones = screen.getAllByTestId('pasteboard-gap')
    expect(
      zones.map((zone) => zone.getAttribute('data-gap-insert-index')),
    ).toEqual(zones.map((_, index) => String(index + 1)))
    expect(zones.length).toBeGreaterThan(0)
    for (const zone of zones) {
      expect(zone.textContent).toBe('Drop here for a new spread')
      expect(zone.getAttribute('aria-hidden')).toBe('true')
      // Centred under the page numbers: 19 / 2 px under the gap centre (M56).
      expect(zone.style.getPropertyValue('--pill-shift')).toBe('9.5px')
    }
  })

  it('only highlights a gap zone while the pointer is over it', () => {
    seedAtPillZoom()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const carried = ['a', 'b']
    document.dispatchEvent(dragEvent('dragstart', carried))
    scroll.dispatchEvent(dragEvent('dragover', carried, { x: 5, y: 1 }))
    expect(scroll.querySelector('[data-drop-hover="true"]')).toBeNull()
    scroll.dispatchEvent(
      dragEvent('dragover', carried, {
        x: 5,
        y: geometry(PILL_ZOOM).stridePx - 4,
      }),
    )
    expect(scroll.querySelectorAll('[data-drop-hover="true"]')).toHaveLength(1)
    scroll.dispatchEvent(dragEvent('dragover', carried, { x: 5, y: 1 }))
    expect(scroll.querySelector('[data-drop-hover="true"]')).toBeNull()
  })

  it('does nothing when photos are dropped on a spread but not on a frame or gap', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const before = getBookStoreSnapshot().book
    document.dispatchEvent(dragEvent('dragstart', ['a', 'b']))
    scroll.dispatchEvent(dragEvent('drop', ['a', 'b'], { x: 1, y: 1 }))
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('treats a stale multi payload without the dragged photo as a single drop', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const point = firstFramePoint()
    const transfer = new DataTransfer()
    transfer.setData(ASSET_DRAG_MIME, 'a')
    transfer.setData(ASSET_MULTI_MIME, encodeAssetIds(['b', 'c']))
    const start = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(start, 'dataTransfer', { value: transfer })
    document.dispatchEvent(start)
    scroll.dispatchEvent(dragEvent('drop', ['a'], point))
    expect(assets()).toEqual(['a', undefined, undefined, undefined])
  })

  it('a frame drag never hovers or drops into a new-spread gap', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const book = getBookStoreSnapshot().book
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    assert(spread !== undefined && frame !== undefined)
    const y = geometry().stridePx - 4
    const frameEvent = (type: string): DragEvent => {
      const transfer = new DataTransfer()
      transfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: spread.id, frameId: frame.id }),
      )
      const event = new DragEvent(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: transfer })
      Object.defineProperty(event, 'clientX', { value: 5 })
      Object.defineProperty(event, 'clientY', { value: y })
      return event
    }
    document.dispatchEvent(frameEvent('dragstart'))
    scroll.dispatchEvent(frameEvent('dragover'))
    expect(scroll.querySelector('[data-drop-hover="true"]')).toBeNull()
    scroll.dispatchEvent(frameEvent('drop'))
    expect(getBookStoreSnapshot().book).toBe(book)
    expect(scroll.dataset.assetDrag).toBeUndefined()
  })

  it('a single-photo drop in the gap still creates a spread', () => {
    seed()
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const y = geometry().stridePx - 4
    const count = getBookStoreSnapshot().book.spreads.length
    document.dispatchEvent(dragEvent('dragstart', ['a']))
    scroll.dispatchEvent(dragEvent('drop', ['a'], { x: 5, y }))
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(count + 1)
  })
})

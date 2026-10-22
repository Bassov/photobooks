import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTemplate, placeAsset } from '../core'
import { resetAssetPool } from '../photo/assetPool'
import assert from 'node:assert/strict'
import {
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  resetBookStore,
  setAssetSessionMeta,
  type AssetSessionMeta,
} from './bookStore'
import { clearDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  FRAME_DRAG_MIME,
  encodeFrameDrag,
} from './dropTargets'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'
import { Filmstrip } from './Filmstrip'
import { Pasteboard } from './Pasteboard'
import { seedGallery } from './gallery.test-helpers'
import { resetCameraStore } from './cameraStore'
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

const CYRILLIC_FILE_NAME = 'фото отпуск 01.jpg'

describe('Filmstrip thumbnail file name', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    resetGallerySelection()
    resetFrameSelection()
    clearDropHover()
    vi.unstubAllGlobals()
  })

  it('uses the session file name as the thumbnail accessible name', () => {
    const ids = seedGallery(1, 1.5, CYRILLIC_FILE_NAME)
    const assetId = ids[0]
    assert(assetId !== undefined, 'expected an asset')

    render(<Filmstrip />)

    expect(screen.getByRole('row', { name: CYRILLIC_FILE_NAME })).toBeTruthy()
    expect(screen.queryByRole('row', { name: assetId })).toBeNull()
  })

  it('uses the asset id when the session file name is blank', () => {
    const ids = seedGallery(1, 1.5, '')
    const assetId = ids[0]
    assert(assetId !== undefined, 'expected an asset')

    render(<Filmstrip />)

    expect(screen.getByRole('row', { name: assetId })).toBeTruthy()
  })

  it('updates the thumbnail name when session meta arrives', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const ids = seedGallery(1, 1.5, '')
    const assetId = ids[0]
    assert(assetId !== undefined, 'expected an asset')
    const meta = getBookStoreSnapshot().sessionMeta.get(assetId)
    assert(meta !== undefined, 'expected session meta')
    render(<Filmstrip />)

    act(() => {
      setAssetSessionMeta(assetId, { ...meta, name: CYRILLIC_FILE_NAME })
    })

    expect(getGalleryIdsSnapshot()).toEqual(ids)
    expect(screen.getByRole('row', { name: CYRILLIC_FILE_NAME })).toBeTruthy()
  })
})

describe('Filmstrip viewport containment', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    resetGallerySelection()
    resetFrameSelection()
    clearDropHover()
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
    clearDropHover()
    resetCameraStore()
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

  it('shows a Placed badge on a placed asset and keeps it in the gallery', () => {
    const ids = seedGallery(2)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(800)

    try {
      render(<Filmstrip />)

      const items = screen.getAllByTestId('filmstrip-item')
      expect(items).toHaveLength(2)
      expect(
        items[0]?.querySelector('[data-testid="filmstrip-placed"]'),
      ).not.toBeNull()
      expect(
        items[1]?.querySelector('[data-testid="filmstrip-placed"]'),
      ).toBeNull()
      expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
    } finally {
      restore()
    }
  })

  it('puts the asset id on dragstart and selects that item', () => {
    const ids = seedGallery(1)
    const assetId = ids[0]
    assert(assetId !== undefined, 'expected an asset')
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      const dataTransfer = new DataTransfer()
      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      const item = screen.getByTestId('filmstrip-item')
      const handle = item.querySelector('.filmstrip-drag')
      assert(handle instanceof HTMLElement, 'expected a drag handle')
      act(() => {
        handle.dispatchEvent(event)
      })

      expect(handle.getAttribute('draggable')).toBe('true')
      expect(getSelectedAssetId()).toBe(assetId)
      expect(dataTransfer.getData(ASSET_DRAG_MIME)).toBe(assetId)
      expect(
        screen.getByTestId('filmstrip-item').getAttribute('aria-selected'),
      ).toBe('true')
    } finally {
      restore()
    }
  })

  it('unplaces the keyboard source and keeps the photo in the gallery', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    setFrameSource({ spreadId: spread.id, frameId })
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      expect(screen.getByRole('button', { name: 'Unplace' })).toBeTruthy()
      act(() => {
        screen.getByRole('button', { name: 'Unplace' }).click()
      })

      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
      ).toBeUndefined()
      expect(getBookStoreSnapshot().book.gallery).toEqual([placedId])
      expect(screen.queryByTestId('filmstrip-placed')).toBeNull()
      expect(
        document.querySelector('.filmstrip-unplace')?.hasAttribute('disabled'),
      ).toBe(true)
    } finally {
      restore()
    }
  })

  it('drops a frame on the filmstrip and clears that placement', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: spread.id, frameId }),
      )
      const start = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(start, 'dataTransfer', { value: dataTransfer })
      document.dispatchEvent(start)
      const over = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(over, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(over)
      expect(scroll.getAttribute('data-drop-hover')).toBe('true')

      const drop = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(drop)

      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
      ).toBeUndefined()
      expect(getBookStoreSnapshot().book.gallery).toEqual([placedId])
      expect(scroll.getAttribute('data-drop-hover')).toBeNull()
    } finally {
      restore()
    }
  })

  it('does not hover the filmstrip for a frame MIME without a local dragstart', () => {
    seedGallery(1)
    const restore = stubScrollportWidth(400)
    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: 's', frameId: 'f' }),
      )
      const over = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(over, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(over)
      expect(scroll.getAttribute('data-drop-hover')).toBeNull()
    } finally {
      restore()
    }
  })

  it('clears frame-drag arming when an asset drag starts', () => {
    seedGallery(1)
    const restore = stubScrollportWidth(400)
    try {
      render(
        <>
          <Pasteboard />
          <Filmstrip />
        </>,
      )
      const filmstrip = screen.getByTestId('filmstrip-scroll')
      const frameTransfer = new DataTransfer()
      frameTransfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: 's', frameId: 'f' }),
      )
      const frameStart = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(frameStart, 'dataTransfer', {
        value: frameTransfer,
      })
      document.dispatchEvent(frameStart)
      const assetTransfer = new DataTransfer()
      assetTransfer.setData(ASSET_DRAG_MIME, 'seed-0')
      const assetStart = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(assetStart, 'dataTransfer', {
        value: assetTransfer,
      })
      document.dispatchEvent(assetStart)
      const over = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(over, 'dataTransfer', { value: frameTransfer })
      filmstrip.dispatchEvent(over)
      expect(filmstrip.getAttribute('data-drop-hover')).toBeNull()
    } finally {
      restore()
    }
  })

  it('ignores a local frame dragstart whose drop payload cannot be read', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(400)
    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const start = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(start, 'dataTransfer', {
        value: {
          types: [FRAME_DRAG_MIME],
          getData: () => '',
          setData: () => undefined,
          effectAllowed: 'move',
          dropEffect: 'none',
        },
      })
      document.dispatchEvent(start)
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: {
          types: [FRAME_DRAG_MIME],
          getData: () => '',
          setData: () => undefined,
          effectAllowed: 'move',
          dropEffect: 'none',
        },
      })
      scroll.dispatchEvent(drop)
      expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
        placedId,
      )
    } finally {
      restore()
    }
  })

  it('does not reuse frame-drag arming after a successful filmstrip unplace', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    let book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(400)
    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: spread.id, frameId }),
      )
      const start = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(start, 'dataTransfer', { value: dataTransfer })
      document.dispatchEvent(start)
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(drop)
      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
      ).toBeUndefined()

      book = placeAsset(
        getBookStoreSnapshot().book,
        spread.id,
        frameId,
        placedId,
      )
      resetBookStore({
        book,
        sessionMeta: snap.sessionMeta,
        importRunning: false,
        importExpectedCount: 0,
      })
      const again = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(again, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(again)
      expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
        placedId,
      )
    } finally {
      restore()
    }
  })

  it('ignores a frame drop that did not start in this document', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: spread.id, frameId }),
      )
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer })
      scroll.dispatchEvent(drop)

      expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
        placedId,
      )
    } finally {
      restore()
    }
  })

  it('ignores a filmstrip drop whose payload is not the drag that started here', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spread = snap.book.spreads[0]
    const frameId = spread?.frames[0]?.id
    const placedId = ids[0]
    assert(
      spread !== undefined && frameId !== undefined && placedId !== undefined,
      'expected a frame and an asset',
    )
    const book = placeAsset(snap.book, spread.id, frameId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const started = new DataTransfer()
      started.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: 'other-spread', frameId: 'other-frame' }),
      )
      const start = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(start, 'dataTransfer', { value: started })
      document.dispatchEvent(start)

      const dropped = new DataTransfer()
      dropped.setData(
        FRAME_DRAG_MIME,
        encodeFrameDrag({ spreadId: spread.id, frameId }),
      )
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', { value: dropped })
      scroll.dispatchEvent(drop)

      expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
        placedId,
      )
    } finally {
      restore()
    }
  })

  it('keeps the Placed badge when another placement of that photo remains', () => {
    const ids = seedGallery(1)
    const snap = getBookStoreSnapshot()
    const spreadId = snap.book.spreads[0]?.id
    const placedId = ids[0]
    assert(
      spreadId !== undefined && placedId !== undefined,
      'expected a spread and an asset',
    )
    let book = applyTemplate(snap.book, spreadId, '4-grid')
    const firstId = book.spreads[0]?.frames[0]?.id
    const secondId = book.spreads[0]?.frames[1]?.id
    assert(
      firstId !== undefined && secondId !== undefined,
      'expected two frames',
    )
    book = placeAsset(book, spreadId, firstId, placedId)
    book = placeAsset(book, spreadId, secondId, placedId)
    resetBookStore({
      book,
      sessionMeta: snap.sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    setFrameSource({ spreadId, frameId: firstId })
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      act(() => {
        screen.getByRole('button', { name: 'Unplace' }).click()
      })

      expect(
        getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
      ).toBeUndefined()
      expect(getBookStoreSnapshot().book.spreads[0]?.frames[1]?.assetId).toBe(
        placedId,
      )
      expect(screen.getByTestId('filmstrip-placed')).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('clears the gallery selection on Escape', () => {
    const ids = seedGallery(1)
    const assetId = ids[0]
    assert(assetId !== undefined, 'expected an asset')
    setSelectedAssetId(assetId)
    const restore = stubScrollportWidth(400)

    try {
      render(<Filmstrip />)
      fireEvent.keyDown(screen.getByTestId('filmstrip'), {
        key: 'Escape',
      })
      expect(getSelectedAssetId()).toBeNull()
    } finally {
      restore()
    }
  })

  it('scrolls to a jumped asset and highlights the tile', async () => {
    const { requestFilmstripJump, resetFilmstripJumpForTests } =
      await import('./filmstripJump')
    resetFilmstripJumpForTests()
    const ids = seedGallery(8, 1.5)
    const target = ids[6]
    assert(target !== undefined, 'expected a far asset')
    const restore = stubScrollportWidth(240)
    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      act(() => {
        requestFilmstripJump(target)
      })
      expect(getSelectedAssetId()).toBe(target)
      expect(scroll.scrollLeft).toBeGreaterThan(0)
      expect(document.querySelector('[data-import-jump]')).toBeTruthy()
    } finally {
      restore()
      resetFilmstripJumpForTests()
    }
  })

  it('ignores a jump to an asset that is not in the gallery', async () => {
    const { requestFilmstripJump, resetFilmstripJumpForTests } =
      await import('./filmstripJump')
    resetFilmstripJumpForTests()
    seedGallery(3, 1.5)
    const restore = stubScrollportWidth(240)
    try {
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const before = scroll.scrollLeft
      act(() => {
        requestFilmstripJump('missing-asset')
      })
      expect(scroll.scrollLeft).toBe(before)
    } finally {
      restore()
      resetFilmstripJumpForTests()
    }
  })
})

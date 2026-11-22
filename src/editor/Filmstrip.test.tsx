import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTemplate, placeAsset } from '../core'
import * as assetPool from '../photo/assetPool'
import { resetAssetPool } from '../photo/assetPool'
import assert from 'node:assert/strict'
import {
  dispatchBookOp,
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
import { makeFrame, makeSpread } from '../core/testing/fixtures'
import { getEditorStatus } from './editorStatus'
import {
  getFrameSelection,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { endPhotoPick, startPhotoPick } from './photoPick'
import { resetActiveSpreadIdForTests } from './photoRootSession'
import { resetPlacedJumpForTests } from './placedJump'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'
import { Filmstrip } from './Filmstrip'
import {
  resetImportProgressForTests,
  setImportProgress,
} from './importProgressStore'
import { Pasteboard } from './Pasteboard'
import { seedGallery } from './gallery.test-helpers'
import { resetCameraStore } from './cameraStore'
import * as thumbCache from './thumbCache'
import { resetThumbCache } from './thumbCache'
import {
  buildStridePrefix,
  filmstripWindowRange,
  spacerWidthPx,
  thumbSlotSize,
  thumbWidthMax,
  THUMB_HEIGHT,
  type FilmstripScrollDirection,
} from './thumbSlotSize'
import { setFilmstripThumb, thumbAuto } from './filmstripSize'

/** jsdom window (768 high): the `auto` thumb height is the kit 76 px. */
const FILMSTRIP_THUMB_HEIGHT = thumbAuto(window.innerHeight)

/** Minimum window cover ahead at the fixed filmstrip height (two widest slots). */
const OVERSCAN = thumbWidthMax(FILMSTRIP_THUMB_HEIGHT) * 2

/** Window the strip should mount: one scrollport (≥ OVERSCAN) ahead. */
function expectedWindow(
  prefix: readonly number[],
  scrollLeft: number,
  width: number,
  direction: FilmstripScrollDirection = 1,
): { start: number; count: number } {
  const range = filmstripWindowRange(
    prefix,
    scrollLeft,
    width,
    direction,
    Math.max(width, OVERSCAN),
  )
  return { start: range.start, count: range.end - range.start }
}

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

  it('publishes concrete filmstrip window asset ids for decode priority', () => {
    const ids = seedGallery(3, 1.5, 'n.jpg')
    const visible = vi.spyOn(assetPool, 'setFilmstripVisibleAssetIds')
    render(<Filmstrip />)
    expect(visible).toHaveBeenCalled()
    const published = visible.mock.calls.at(-1)?.[0]
    expect(published).toEqual(expect.arrayContaining(ids.slice(0, 1)))
    expect(published?.every((id) => typeof id === 'string')).toBe(true)
    expect(published?.every((id) => id.length > 0)).toBe(true)
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

describe('Filmstrip low-res chip (r15 M85)', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  function chipOf(assetId: string): Element | null {
    return document.querySelector(
      `[data-asset-id="${assetId}"] [data-testid="lowres-chip"]`,
    )
  }

  it('flags photos below the page-fill threshold and follows the trim', () => {
    resetBookStore()
    const snap = getBookStoreSnapshot()
    resetBookStore({
      book: {
        ...snap.book,
        settings: {
          ...snap.book.settings,
          trim: { widthMm: 190, heightMm: 230 },
        },
        // Book-record dims: 1600 × 2000 is ≈ 214 dpi on 19 × 23 cm.
        assets: {
          sharp: { widthPx: 1600, heightPx: 2000 },
          soft: { widthPx: 800, heightPx: 1000 },
          unknown: {},
        },
        gallery: ['sharp', 'soft', 'unknown'],
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Filmstrip />)
    expect(screen.getAllByTestId('filmstrip-item')).toHaveLength(3)
    expect(chipOf('sharp')).toBeNull()
    // P11: always icon-only; the name lives on the chip itself.
    expect(chipOf('soft')?.textContent).toBe('')
    expect(chipOf('soft')?.getAttribute('aria-label')).toBe('Low-res')
    expect(chipOf('soft')?.getAttribute('title')).toBe('Low-res')
    expect(chipOf('unknown')).toBeNull()

    // A4 pages: 2000 px over 297 mm ≈ 171 dpi.
    act(() => {
      dispatchBookOp({ type: 'setTrim', widthMm: 210, heightMm: 297 })
    })
    expect(chipOf('sharp')).not.toBeNull()
  })

  it('prefers the decoded pixel size over the book record', () => {
    resetBookStore()
    const snap = getBookStoreSnapshot()
    resetBookStore({
      book: {
        ...snap.book,
        settings: {
          ...snap.book.settings,
          trim: { widthMm: 190, heightMm: 230 },
        },
        assets: { photo: { widthPx: 100, heightPx: 100 } },
        gallery: ['photo'],
      },
      sessionMeta: new Map([
        [
          'photo',
          {
            name: 'photo',
            correctedWidth: 4000,
            correctedHeight: 6000,
            orientation: 1,
            aspect: 4000 / 6000,
          },
        ],
      ]),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Filmstrip />)
    expect(screen.getAllByTestId('filmstrip-item')).toHaveLength(1)
    expect(chipOf('photo')).toBeNull()
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
      `${String(spacerWidthPx(aspects, 80, 1, FILMSTRIP_THUMB_HEIGHT))}px`,
    )
    expect(
      screen.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    ).toBe('80')
  })

  it('feeds the separator height H to strides, spacer and slot height', () => {
    seedGallery(80)
    render(<Filmstrip />)
    act(() => {
      setFilmstripThumb(128, false)
    })
    const aspects = Array.from({ length: 80 }, () => 1.5)
    const spacer = document.querySelector<HTMLElement>('.filmstrip-spacer')
    const win = screen.getByTestId('filmstrip-window')
    try {
      expect(spacer?.style.width).toBe(
        `${String(spacerWidthPx(aspects, 80, 1, 128))}px`,
      )
      expect(win.style.getPropertyValue('--film-slot-h')).toBe('128px')
      // Window covers the scrollport + overscan at the larger slot width.
      expect(Number(win.dataset.windowCount)).toBeLessThan(80)
    } finally {
      act(() => {
        setFilmstripThumb('auto', false)
      })
    }
    expect(win.style.getPropertyValue('--film-slot-h')).toBe('76px')
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

  it('packs items from each card end + gap (not max-width slots)', () => {
    expect(filmstripCss).toMatch(
      /\.filmstrip-list\s*\{[^}]*display:\s*flex[^}]*gap:\s*8px/s,
    )
    expect(filmstripCss).toMatch(
      /\.filmstrip-item\s*\{[^}]*flex:\s*none[^}]*--slot-aspect/s,
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
    vi.restoreAllMocks()
  })

  it('renders distinct widths for landscape, portrait, and square', () => {
    seedMixedAspectGallery()
    render(<Filmstrip />)

    const items = screen.getAllByTestId('filmstrip-item')
    expect(items).toHaveLength(3)
    expect(items[0]?.getAttribute('data-orientation')).toBe('landscape')
    expect(items[1]?.getAttribute('data-orientation')).toBe('portrait')
    expect(items[2]?.getAttribute('data-orientation')).toBe('square')

    // CSS sizes each slot from --film-slot-h × --slot-aspect (flex row packs
    // origins by card width + gap); widths match thumbSlotSize at that height.
    const aspects = items.map((item) =>
      Number(item.style.getPropertyValue('--slot-aspect')),
    )
    expect(aspects).toEqual([1.5, 0.5, 1])
    for (const [index, aspect] of [1.5, 0.5, 1].entries()) {
      expect(Math.round(THUMB_HEIGHT * (aspects[index] ?? 0))).toBe(
        thumbSlotSize(aspect).width,
      )
    }
    expect(
      screen
        .getByTestId('filmstrip-window')
        .style.getPropertyValue('--film-slot-h'),
    ).toBe(`${String(FILMSTRIP_THUMB_HEIGHT)}px`)
    expect(items.some((item) => item.style.left !== '')).toBe(false)
  })

  it('renders no count line (the dock header owns the count)', () => {
    seedGallery(3)
    render(<Filmstrip />)
    expect(screen.queryByTestId('filmstrip-count')).toBeNull()
  })

  it('shows import progress on the status strip', () => {
    seedGallery(1)
    setImportProgress({
      total: 10,
      completed: 3,
      errors: [],
      running: true,
    })
    render(<Filmstrip />)
    expect(screen.getByTestId('import-progress').textContent).toMatch(
      /Importing 3 \/ 10/,
    )
    resetImportProgressForTests()
  })

  it('notes filmstrip scroll so thumb publishes can quiet during scroll', () => {
    seedGallery(8)
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const noteScroll = vi.spyOn(thumbCache, 'noteFilmstripScroll')
    render(<Filmstrip />)
    const scroll = screen.getByTestId('filmstrip-scroll')
    Object.defineProperty(scroll, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 160,
    })
    fireEvent.scroll(scroll)
    Object.defineProperty(scroll, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 320,
    })
    // Second scroll in the same frame hits the rAF coalescing early-return.
    fireEvent.scroll(scroll)
    expect(noteScroll).toHaveBeenCalledTimes(2)
    expect(rafQueue).toHaveLength(1)
    noteScroll.mockRestore()
    vi.unstubAllGlobals()
  })

  it('keeps empty-state copy full-width (not a 1px virtualizer window)', () => {
    resetBookStore()
    render(<Filmstrip />)

    const empty = screen.getByTestId('filmstrip-empty')
    expect(empty.textContent).toBe(
      'No photos yet — add a folder or drop one here.',
    )
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
      const prefix = buildStridePrefix(aspects, FILMSTRIP_THUMB_HEIGHT)
      const { start, count: expected } = expectedWindow(prefix, 0, 1200)
      expect(start).toBe(0)
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
      const prefix = buildStridePrefix(
        Array.from({ length: 50 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
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

      const { count: expected } = expectedWindow(prefix, scrollLeft, 1000)
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

  it('reaches one scrollport ahead in the scroll direction and reports scrollport ids', () => {
    const restore = stubScrollportWidth(1000)
    const callbacks: FrameRequestCallback[] = []
    const previousRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      callbacks.push(cb)
      return callbacks.length
    }
    const register = vi.spyOn(thumbCache, 'setThumbViewportProvider')

    try {
      const ids = seedGallery(60, 0.5)
      render(<Filmstrip />)
      const provider = register.mock.calls[0]?.[0]
      assert(provider !== undefined)

      const scroll = screen.getByTestId('filmstrip-scroll')
      const prefix = buildStridePrefix(
        Array.from({ length: 60 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      const scrollTo = (left: number): void => {
        act(() => {
          Object.defineProperty(scroll, 'scrollLeft', {
            configurable: true,
            value: left,
            writable: true,
          })
          scroll.dispatchEvent(new Event('scroll'))
          for (const cb of callbacks.splice(0, callbacks.length)) {
            cb(0)
          }
        })
      }
      const windowEl = screen.getByTestId('filmstrip-window')
      const mounted = (): { start: number; count: number } => ({
        start: ids.indexOf(
          screen.getAllByTestId('filmstrip-item')[0]?.dataset.assetId ?? '',
        ),
        count: Number(windowEl.getAttribute('data-window-count')),
      })

      scrollTo(prefix[30] ?? 0)
      expect(mounted()).toEqual(expectedWindow(prefix, prefix[30] ?? 0, 1000))
      expect(mounted().start).toBe(28)

      const back = prefix[24] ?? 0
      scrollTo(back)
      const backward = expectedWindow(prefix, back, 1000, -1)
      expect(mounted()).toEqual(backward)
      // A forward window would start 2 slots behind the view (22).
      expect(backward.start).toBeLessThan(22)
      expect(prefix[backward.start] ?? 0).toBeLessThanOrEqual(back - 1000)

      const view = provider()
      expect(view[0]).toBe(ids[24])
      expect(view.length).toBeGreaterThan(10)
      expect(view.length).toBeLessThan(backward.count)
    } finally {
      globalThis.requestAnimationFrame = previousRaf
      restore()
    }
  })

  it('re-covers the scrollport when aspects refine after scroll without a nudge', () => {
    // IMP-11/FS-03: mid-import aspect refine shifts the stride prefix; stale
    // windowStart left a blank hole until the next wheel event.
    const restore = stubScrollportWidth(900)
    const callbacks: FrameRequestCallback[] = []
    const previousRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      callbacks.push(cb)
      return callbacks.length
    }

    try {
      const initial = seedGallery(24, 1.5)
      render(<Filmstrip />)

      const scroll = screen.getByTestId('filmstrip-scroll')
      const landPrefix = buildStridePrefix(
        Array.from({ length: 24 }, () => 1.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      const scrollLeft = landPrefix[8] ?? 0

      act(() => {
        Object.defineProperty(scroll, 'scrollLeft', {
          configurable: true,
          get: () => scrollLeft,
          set: () => undefined,
        })
        scroll.dispatchEvent(new Event('scroll'))
        for (const cb of callbacks.splice(0, callbacks.length)) {
          cb(0)
        }
      })

      // Import continues: many more ids + existing cards refine to portrait.
      const grown = Array.from(
        { length: 160 },
        (_, index) => `seed-extra-${String(index)}`,
      )
      const allIds = [...initial, ...grown]
      const snap = getBookStoreSnapshot()
      const assets = { ...snap.book.assets }
      const sessionMeta = new Map<string, AssetSessionMeta>()
      for (const id of allIds) {
        assets[id] = assets[id] ?? {}
        sessionMeta.set(id, {
          name: id,
          correctedWidth: 50,
          correctedHeight: 100,
          orientation: 1,
          aspect: 0.5,
        })
      }
      act(() => {
        resetBookStore({
          book: { ...snap.book, assets, gallery: allIds },
          sessionMeta,
          importRunning: true,
          importExpectedCount: allIds.length,
        })
      })

      const portPrefix = buildStridePrefix(
        Array.from({ length: allIds.length }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      const { start: windowStart, count: expected } = expectedWindow(
        portPrefix,
        scrollLeft,
        900,
      )
      expect(expected).toBeGreaterThan(14)

      const windowEl = screen.getByTestId('filmstrip-window')
      expect(Number(windowEl.getAttribute('data-window-count'))).toBe(expected)
      expect(screen.getAllByTestId('filmstrip-item')).toHaveLength(expected)

      const windowOffset = portPrefix[windowStart] ?? 0
      // Bound to tracked scrollLeft — kills stale-start and missed setScrollLeft.
      expect(windowEl.style.transform).toBe(
        `translateX(${String(windowOffset)}px)`,
      )
      expect(windowOffset).toBeGreaterThan(0)

      const windowWidth =
        (portPrefix[windowStart + expected] ?? windowOffset) - windowOffset
      const visibleRight = scrollLeft + 900
      const overlap =
        Math.min(windowOffset + windowWidth, visibleRight) -
        Math.max(windowOffset, scrollLeft)
      expect(overlap).toBeGreaterThan(900 * 0.9)

      // Without prefix sync, windowStart would stay at the pre-refine index.
      expect(expectedWindow(landPrefix, scrollLeft, 900).start).not.toBe(
        windowStart,
      )
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

describe('Filmstrip placed badge = Show in the book (placed-badge PB3)', () => {
  /** seed-0 on s0/a and s1/b, seed-1 on 10 frames of s2, seed-2 unplaced. */
  function setup(): void {
    seedGallery(3)
    const { book, sessionMeta } = getBookStoreSnapshot()
    resetBookStore({
      book: {
        ...book,
        spreads: [
          makeSpread({
            id: 's0',
            frames: [makeFrame({ id: 'a', assetId: 'seed-0' })],
          }),
          makeSpread({
            id: 's1',
            frames: [makeFrame({ id: 'b', assetId: 'seed-0' })],
          }),
          makeSpread({
            id: 's2',
            frames: Array.from({ length: 10 }, (_, i) =>
              makeFrame({ id: `m${String(i)}`, assetId: 'seed-1', z: i }),
            ),
          }),
        ],
      },
      sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    restoreWidth = stubScrollportWidth(800)
    render(<Filmstrip />)
  }

  let restoreWidth: (() => void) | undefined

  function row(id: string): HTMLElement {
    const match = screen
      .getAllByTestId('filmstrip-item')
      .find((item) => item.dataset.assetId === id)
    assert(match !== undefined, `row ${id} not mounted`)
    return match
  }

  function badge(id: string): HTMLElement {
    const match = row(id).querySelector<HTMLElement>(
      '[data-testid="filmstrip-placed"]',
    )
    assert(match !== null, `badge ${id} missing`)
    return match
  }

  const selectedFrame = () => {
    const selection = getFrameSelection()
    return selection === null
      ? null
      : `${selection.spreadId}/${selection.frameIds.join(',')}`
  }

  afterEach(() => {
    act(() => {
      endPhotoPick()
    })
    cleanup()
    restoreWidth?.()
    resetPlacedJumpForTests()
    resetActiveSpreadIdForTests()
    resetFrameSelection()
    resetGallerySelection()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
  })

  it('is a non-focusable button with the place count in its label', () => {
    setup()

    expect(badge('seed-0').getAttribute('role')).toBe('button')
    expect(badge('seed-0').hasAttribute('tabindex')).toBe(false)
    expect(badge('seed-0').title).toBe('Show in the book')
    expect(badge('seed-0').getAttribute('aria-label')).toBe(
      'Show in the book, placed 2 times',
    )
    expect(badge('seed-0').textContent).toBe('2')
    expect(badge('seed-1').textContent).toBe('9+')
    expect(badge('seed-1').getAttribute('aria-label')).toBe(
      'Show in the book, placed 10 times',
    )
    expect(row('seed-0').getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(row('seed-2').hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(
      row('seed-2').querySelector('[data-testid="filmstrip-placed"]'),
    ).toBeNull()
  })

  it('reads "Show in the book" alone for one place', () => {
    setup()
    act(() => {
      dispatchBookOp({
        type: 'unplace',
        spreadId: 's1',
        frameId: 'b',
      })
    })

    expect(badge('seed-0').getAttribute('aria-label')).toBe('Show in the book')
    expect(badge('seed-0').hasAttribute('data-count')).toBe(false)
    expect(badge('seed-0').textContent).toBe('')
  })

  it('a badge click jumps and cycles without selecting the row', () => {
    setup()

    fireEvent.click(badge('seed-0'))
    expect(selectedFrame()).toBe('s0/a')
    expect(getSelectedAssetId()).toBeNull()
    expect(row('seed-0').getAttribute('aria-selected')).toBe('false')

    fireEvent.click(badge('seed-0'))
    expect(selectedFrame()).toBe('s1/b')
    expect(getEditorStatus()).toBe('Placed 2 of 2 · Pages 2–3')
  })

  it('Enter on a placed row jumps; on an unplaced row it does nothing', () => {
    setup()

    const reachedDocument = vi.fn()
    document.addEventListener('keydown', reachedDocument)
    try {
      // Handled here: default prevented, the editor's Enter never sees it.
      expect(fireEvent.keyDown(row('seed-0'), { key: 'Enter' })).toBe(false)
      expect(selectedFrame()).toBe('s0/a')
      expect(reachedDocument).not.toHaveBeenCalled()

      act(() => {
        resetFrameSelection()
      })
      expect(fireEvent.keyDown(row('seed-2'), { key: 'Enter' })).toBe(true)
      expect(selectedFrame()).toBeNull()
      expect(getSelectedAssetId()).toBeNull()
      expect(reachedDocument).toHaveBeenCalledTimes(1)
    } finally {
      document.removeEventListener('keydown', reachedDocument)
    }
  })

  it('double-click on a placed row jumps; the badge and unplaced rows do not add one', () => {
    setup()

    fireEvent.doubleClick(row('seed-2'))
    expect(selectedFrame()).toBeNull()

    fireEvent.doubleClick(badge('seed-0'))
    expect(selectedFrame()).toBeNull()

    fireEvent.doubleClick(row('seed-0'))
    expect(selectedFrame()).toBe('s0/a')
  })

  it('pick mode wins over the badge, Enter and double-click (B6)', () => {
    setup()
    act(() => {
      startPhotoPick({ spreadId: 's1', frameId: 'b', kind: 'replace' })
    })

    fireEvent.click(badge('seed-1'), { detail: 1 })
    // The pick replaced s1/b with seed-1 and ended the mode; no jump.
    expect(getBookStoreSnapshot().book.spreads[1]?.frames[0]?.assetId).toBe(
      'seed-1',
    )
    expect(getEditorStatus()).not.toMatch(/^Placed/)

    // The rest of that double-click on the badge: no jump.
    fireEvent.click(badge('seed-1'), { detail: 2 })
    fireEvent.doubleClick(row('seed-0'))
    expect(getEditorStatus()).not.toMatch(/^Placed/)
    // Still the picked frame: a jump would select seed-0's s0/a.
    expect(selectedFrame()).toBe('s1/b')
    expect(getSelectedAssetId()).toBeNull()

    // A new click after the pick is a jump again.
    fireEvent.click(badge('seed-0'), { detail: 1 })
    expect(selectedFrame()).toBe('s0/a')
  })

  it('counts up to 9, then 9+', () => {
    setup()
    act(() => {
      dispatchBookOp({ type: 'unplace', spreadId: 's2', frameId: 'm0' })
    })

    expect(badge('seed-1').textContent).toBe('9')
    expect(badge('seed-0').hasAttribute('data-count')).toBe(true)
  })
})

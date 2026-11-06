import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCover } from '../core'
import { makeBookWithAsset } from '../core/testing/fixtures'
import * as tierCache from '../photo/tierCache'
import { maxDesiredTier, resetTierDisplay } from './tierDisplay'
import { CoverCanvas } from './CoverCanvas'
import { CoverOverlay } from './CoverOverlay'
import { CoverSection } from './CoverSection'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { setCoverSelected } from './coverSelection'
import { readCoverGeometry } from './coverSelectors'
import { ASSET_DRAG_MIME } from './dropTargets'

const thumbs = vi.hoisted(() => new Map<string, string>())
const listeners = vi.hoisted(() => new Map<string, Set<() => void>>())
vi.mock('./thumbCache', () => ({
  getThumbUrl: (id: string) => thumbs.get(id),
  subscribeThumb: (id: string, listener: () => void) => {
    const set = listeners.get(id) ?? new Set()
    set.add(listener)
    listeners.set(id, set)
    return () => set.delete(listener)
  },
}))

function seed(title = 'Lake trip') {
  resetBookStore({
    book: {
      ...makeBookWithAsset('a1', { place: false }),
      cover: defaultCover(title),
    },
    sessionMeta: new Map([
      [
        'a1',
        {
          name: 'IMG_0001.jpg',
          correctedWidth: 10,
          correctedHeight: 10,
          orientation: 1,
          aspect: 1,
        },
      ],
    ]),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function must<T>(value: T | null): T {
  if (value === null) {
    throw new Error('missing element')
  }
  return value
}

const dropEvent = (types: string[], data: string) => ({
  dataTransfer: {
    types,
    getData: () => data,
    dropEffect: 'none',
  },
})

describe('CoverCanvas', () => {
  beforeEach(() => {
    seed()
  })
  afterEach(() => {
    cleanup()
    thumbs.clear()
    listeners.clear()
    setCoverSelected(false)
    resetBookStore()
    resetTierDisplay()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('draws back · spine · front from the page size with the title text', () => {
    render(<CoverCanvas />)
    expect(screen.getByTestId('cover-front-text').textContent).toBe('Lake trip')
    expect(screen.getByTestId('cover-spine-text').textContent).toBe('Lake trip')
    expect(screen.getByTestId('cover-back-text').textContent).toBe('Lake trip')
    // makeBook trims to 300 mm; the generic profile spine is 12 mm at the
    // 20-page minimum, of a 612 mm cover in a 642 × 330 mm sheet.
    const pct = (id: string) =>
      Number.parseFloat(screen.getByTestId(id).style.width)
    expect(pct('cover-back')).toBeCloseTo((300 / 612) * 100, 5)
    expect(pct('cover-front')).toBeCloseTo((300 / 612) * 100, 5)
    expect(pct('cover-spine')).toBeCloseTo((12 / 612) * 100, 5)
    expect(pct('canvas-cover')).toBeCloseTo((612 / 642) * 100, 5)
    const sheet = screen.getByTestId('cover-sheet')
    expect(sheet.style.aspectRatio.replace(/\s/g, '')).toBe('642/330')
  })

  it('keeps the geometry object across a text edit and swaps it on Pages', () => {
    const first = readCoverGeometry()
    act(() => {
      dispatchBookOp({ type: 'setCoverText', panel: 'back', text: 'x' })
    })
    expect(readCoverGeometry()).toBe(first)
    act(() => {
      dispatchBookOp({ type: 'setPageCount', pages: 60 })
    })
    const next = readCoverGeometry()
    expect(next).not.toBe(first)
    expect(next.spine).toBe(20)
  })

  it('shows the cover photo thumb once published', () => {
    act(() => {
      getBookStoreSnapshot()
    })
    thumbs.set('a1', 'blob:a1')
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        cover: {
          ...getBookStoreSnapshot().book.cover,
          front: { text: 'x', assetId: 'a1' },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<CoverCanvas />)
    const front = screen.getByTestId('cover-front')
    expect(
      screen.getByTestId('cover-front-photo').style.backgroundImage,
    ).toContain('blob:a1')
    expect(front.getAttribute('data-photo-id')).toBe('a1')
  })

  it('the canvas front swaps to the working preview; the list row stays on the thumb', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.spyOn(tierCache, 'getTierUrl').mockImplementation((id, tier) =>
      id === 'a1' && tier === 1280 ? 'blob:a1-1280' : undefined,
    )
    const requestTier = vi
      .spyOn(tierCache, 'requestTier')
      .mockImplementation(() => undefined)
    vi.spyOn(tierCache, 'subscribeTier').mockImplementation(
      () => () => undefined,
    )
    thumbs.set('a1', 'blob:a1')
    const { book } = getBookStoreSnapshot()
    resetBookStore({
      book: {
        ...book,
        cover: { ...book.cover, front: { ...book.cover.front, assetId: 'a1' } },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const row = render(<CoverCanvas mini />)
    expect(requestTier).not.toHaveBeenCalled()
    const canvas = render(<CoverCanvas tierSlot="cover:canvas" />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      screen.getByTestId('cover-front-photo').style.backgroundImage,
    ).toContain('blob:a1-1280')
    expect(screen.getByTestId('cover-front').dataset.tier).toBe('1280')
    const rowFront = must(
      row.container.querySelector<HTMLElement>('[data-photo-id="a1"]'),
    )
    const rowPhoto = must(
      rowFront.querySelector<HTMLElement>('.cover-front-photo'),
    )
    expect(rowPhoto.style.backgroundImage).toContain('blob:a1')
    expect(rowPhoto.style.backgroundImage).not.toContain('1280')
    expect(rowFront.hasAttribute('data-tier')).toBe(false)
    canvas.unmount()
    expect(maxDesiredTier('a1')).toBeUndefined()
  })

  it('an empty front stays plain and requests no tier', () => {
    const requestTier = vi
      .spyOn(tierCache, 'requestTier')
      .mockImplementation(() => undefined)
    render(<CoverCanvas tierSlot="cover:canvas" />)
    expect(screen.queryByTestId('cover-front-photo')).toBeNull()
    expect(screen.getByTestId('cover-front').hasAttribute('data-tier')).toBe(
      false,
    )
    expect(requestTier).not.toHaveBeenCalled()
  })

  it('a filmstrip photo dropped on the front band becomes the cover photo', () => {
    vi.stubGlobal('DragEvent', class extends MouseEvent {})
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 642, height: 330 }),
    )
    render(<CoverCanvas />)
    // The right wrap band: past the front board (627 mm of the 642 mm sheet).
    const front = screen.getByTestId('cover-wrap')
    const over = { ...dropEvent([ASSET_DRAG_MIME], 'a1'), clientX: 635 }
    expect(fireEvent.dragOver(front, over)).toBe(false)
    expect(fireEvent.drop(front, over)).toBe(false)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBe('a1')
  })

  it('a photo dropped on the back board is refused', () => {
    vi.stubGlobal('DragEvent', class extends MouseEvent {})
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 642, height: 330 }),
    )
    render(<CoverCanvas />)
    const back = screen.getByTestId('cover-back')
    const over = { ...dropEvent([ASSET_DRAG_MIME], 'a1'), clientX: 100 }
    expect(fireEvent.dragOver(back, over)).toBe(true)
    expect(fireEvent.drop(back, over)).toBe(true)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBeUndefined()
  })

  it('ignores foreign drags and empty payloads', () => {
    render(<CoverCanvas />)
    const front = screen.getByTestId('cover-front')
    expect(fireEvent.dragOver(front, dropEvent(['Files'], ''))).toBe(true)
    expect(fireEvent.drop(front, dropEvent(['Files'], ''))).toBe(true)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBeUndefined()
  })

  it('the mini thumb has no test ids and takes no drops', () => {
    render(<CoverCanvas mini />)
    expect(screen.queryByTestId('canvas-cover')).toBeNull()
    expect(screen.queryByTestId('cover-front')).toBeNull()
    expect(screen.queryByTestId('cover-stage')).toBeNull()
    const spread = must(document.querySelector<HTMLElement>('.cover-spread'))
    expect(spread.getAttribute('data-mini')).toBe('true')
    expect(spread.style.width).toBe('100%')
    const front = must(spread.querySelector<HTMLElement>('.cover-front'))
    fireEvent.drop(front, dropEvent([ASSET_DRAG_MIME], 'a1'))
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBeUndefined()
  })

  it('CoverOverlay renders the canvas only while the cover is selected', () => {
    render(<CoverOverlay />)
    expect(screen.queryByTestId('canvas-cover')).toBeNull()
    act(() => {
      setCoverSelected(true)
    })
    expect(screen.getByTestId('canvas-cover')).toBeTruthy()
    act(() => {
      setCoverSelected(false)
    })
    expect(screen.queryByTestId('canvas-cover')).toBeNull()
  })
})

describe('CoverSection', () => {
  beforeEach(() => {
    seed()
  })
  afterEach(() => {
    cleanup()
    thumbs.clear()
    listeners.clear()
    resetBookStore()
  })

  it('shows the three texts and edits the document', () => {
    render(<CoverSection />)
    expect(screen.getByTestId('inspector-context').textContent).toBe('Cover')
    const front = screen.getByTestId<HTMLInputElement>('cover-text-front')
    expect(front.value).toBe('Lake trip')
    expect(front.placeholder).toBe('Front title')
    fireEvent.change(front, { target: { value: 'Lake 2026' } })
    expect(getBookStoreSnapshot().book.cover.front.text).toBe('Lake 2026')
    fireEvent.change(screen.getByTestId('cover-text-spine'), {
      target: { value: 'Lake' },
    })
    expect(getBookStoreSnapshot().book.cover.spine.text).toBe('Lake')
    fireEvent.change(screen.getByTestId('cover-text-back'), {
      target: { value: 'Thanks' },
    })
    expect(getBookStoreSnapshot().book.cover.back.text).toBe('Thanks')
  })

  it('reports no photo until one is on the front, then its file name', () => {
    thumbs.set('a1', 'blob:a1')
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain(
      'No photo yet',
    )
    expect(screen.getByTestId('cover-front-thumb').style.backgroundImage).toBe(
      '',
    )
    act(() => {
      resetBookStore({
        book: {
          ...getBookStoreSnapshot().book,
          cover: {
            ...getBookStoreSnapshot().book.cover,
            front: { text: 'x', assetId: 'a1' },
          },
        },
        sessionMeta: getBookStoreSnapshot().sessionMeta,
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(screen.getByTestId('insp-cover').textContent).toContain(
      'IMG_0001.jpg',
    )
    expect(
      screen.getByTestId('cover-front-thumb').style.backgroundImage,
    ).toContain('blob:a1')
  })

  it('falls back to the asset id when the file name is unknown', () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        cover: {
          ...getBookStoreSnapshot().book.cover,
          front: { text: 'x', assetId: 'a1' },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('a1')
  })

  it('republishing a thumb updates the preview', () => {
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        cover: {
          ...getBookStoreSnapshot().book.cover,
          front: { text: 'x', assetId: 'a1' },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<CoverSection />)
    expect(screen.getByTestId('cover-front-thumb').style.backgroundImage).toBe(
      '',
    )
    thumbs.set('a1', 'blob:late')
    act(() => {
      for (const l of listeners.get('a1') ?? []) {
        l()
      }
    })
    expect(
      screen.getByTestId('cover-front-thumb').style.backgroundImage,
    ).toContain('blob:late')
  })
})

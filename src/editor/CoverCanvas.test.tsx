import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCover } from '../core'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { CoverCanvas } from './CoverCanvas'
import { CoverOverlay } from './CoverOverlay'
import { CoverSection } from './CoverSection'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { setCoverSelected } from './coverSelection'
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
  })

  it('draws back · spine · front from the page size with the title text', () => {
    render(<CoverCanvas />)
    expect(screen.getByTestId('cover-front-text').textContent).toBe('Lake trip')
    expect(screen.getByTestId('cover-spine-text').textContent).toBe('Lake trip')
    expect(screen.getByTestId('cover-back-text').textContent).toBe('Lake trip')
    // makeBook trims to 300 mm; spine is the display-only 12 mm of 612 mm.
    const pct = (id: string) =>
      Number.parseFloat(screen.getByTestId(id).style.width)
    expect(pct('cover-back')).toBeCloseTo((300 / 612) * 100, 5)
    expect(pct('cover-front')).toBeCloseTo((300 / 612) * 100, 5)
    expect(pct('cover-spine')).toBeCloseTo((12 / 612) * 100, 5)
    const spread = screen.getByTestId('canvas-cover')
    expect(spread.style.aspectRatio.replace(/\s/g, '')).toBe('612/300')
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
    expect(front.style.backgroundImage).toContain('blob:a1')
    expect(front.getAttribute('data-photo-id')).toBe('a1')
  })

  it('a filmstrip photo dropped on the front becomes the cover photo', () => {
    render(<CoverCanvas />)
    const front = screen.getByTestId('cover-front')
    const over = dropEvent([ASSET_DRAG_MIME], 'a1')
    expect(fireEvent.dragOver(front, over)).toBe(false)
    expect(fireEvent.drop(front, over)).toBe(false)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBe('a1')
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

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { SUB } from './editorChromeTokens'
import { PhotoSection } from './PhotoSection'

const thumbs = vi.hoisted(() => new Map<string, string>())
vi.mock('./thumbCache', () => ({
  getThumbUrl: (id: string) => thumbs.get(id),
  subscribeThumb: () => () => undefined,
}))

const target = { spreadId: 'spread-1', frameId: 'frame-1' }
const RECT = { x: 0, y: 0, width: 100, height: 100 }

interface Seed {
  asset?: { widthPx?: number; heightPx?: number; relativePath?: string } | null
  frame?: Partial<Frame>
  meta?: { name: string; w: number; h: number }
}

function seed({ asset = {}, frame = {}, meta }: Seed = {}) {
  resetBookStore({
    book: makeBook({
      assets: asset === null ? {} : { a: asset },
      gallery: ['a'],
      spreads: [
        makeSpread({
          id: 'spread-1',
          frames: [makeFrame({ rect: RECT, assetId: 'a', ...frame })],
        }),
        makeSpread({
          id: 'spread-2',
          frames: [makeFrame({ rect: RECT, ...frame, assetId: undefined })],
        }),
      ],
    }),
    sessionMeta:
      meta === undefined
        ? new Map()
        : new Map([
            [
              'a',
              {
                name: meta.name,
                correctedWidth: meta.w,
                correctedHeight: meta.h,
                orientation: 1 as const,
                aspect: meta.w / meta.h,
              },
            ],
          ]),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const chip = () => screen.getByTestId('inspector-photo-dpi')

describe('PhotoSection', () => {
  afterEach(() => {
    cleanup()
    thumbs.clear()
    resetBookStore()
  })

  it('shows pixels and a green ppi chip at print quality', () => {
    seed({ asset: { widthPx: 1000, heightPx: 1000 } })
    render(<PhotoSection target={target} />)
    expect(screen.getByTestId('inspector-photo-px').textContent).toBe(
      '1000 × 1000 px',
    )
    expect(chip().textContent).toBe('254 ppi')
    expect(chip().getAttribute('data-color')).toBe('success')
    expect(screen.getByTestId('inspector-photo-px').style.color).not.toBe('')
    expect(SUB).not.toBe('')
  })

  it('warns below 200 ppi and errors below 150 ppi', () => {
    seed({ asset: { widthPx: 700, heightPx: 700 } })
    const { unmount } = render(<PhotoSection target={target} />)
    expect(chip().getAttribute('data-color')).toBe('warning')
    unmount()
    seed({ asset: { widthPx: 300, heightPx: 300 } })
    render(<PhotoSection target={target} />)
    expect(chip().getAttribute('data-color')).toBe('error')
  })

  it('prefers the decoded session size and name over the book record', () => {
    seed({
      asset: { widthPx: 10, heightPx: 10, relativePath: 'rel.jpg' },
      meta: { name: 'IMG_9.jpg', w: 2000, h: 2000 },
    })
    render(<PhotoSection target={target} />)
    expect(screen.getByText('IMG_9.jpg')).toBeTruthy()
    expect(screen.getByTestId('inspector-photo-px').textContent).toBe(
      '2000 × 2000 px',
    )
  })

  it('falls back to the relative path, then the asset id, for the name', () => {
    seed({ asset: { relativePath: 'rel.jpg' } })
    const { unmount } = render(<PhotoSection target={target} />)
    expect(screen.getByText('rel.jpg')).toBeTruthy()
    unmount()
    seed({ asset: null })
    render(<PhotoSection target={target} />)
    expect(screen.getByText('a')).toBeTruthy()
  })

  it('omits pixels and ppi when the size is unknown', () => {
    seed({ asset: { widthPx: 100 } })
    render(<PhotoSection target={target} />)
    expect(screen.queryByTestId('inspector-photo-px')).toBeNull()
    expect(screen.queryByTestId('inspector-photo-dpi')).toBeNull()
    expect(screen.getByTestId('photo-remove')).toBeTruthy()
  })

  it('measures a quarter-turned photo across its source height', () => {
    // 2000×1000 turned a quarter in a 100×50 mm frame: the frame width spans
    // the whole turned image width, i.e. the 1000 px source height.
    seed({
      asset: { widthPx: 2000, heightPx: 1000 },
      frame: {
        rect: { x: 0, y: 0, width: 100, height: 50 },
        crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, quarterTurns: 1 },
      },
      meta: { name: 'p.jpg', w: 2000, h: 1000 },
    })
    render(<PhotoSection target={target} />)
    expect(chip().textContent).toBe('254 ppi')
  })

  it('paints the thumb from the filmstrip cache', () => {
    thumbs.set('a', 'blob:a')
    seed({ asset: {} })
    render(<PhotoSection target={target} />)
    expect(
      screen.getByTestId('inspector-photo-thumb').style.backgroundImage,
    ).toBe('url("blob:a")')
  })

  it('leaves the thumb blank until one is published', () => {
    seed({ asset: {} })
    render(<PhotoSection target={target} />)
    expect(
      screen.getByTestId('inspector-photo-thumb').style.backgroundImage,
    ).toBe('')
  })

  it('looks the frame up on its own spread', () => {
    seed({ asset: { widthPx: 1000, heightPx: 1000 } })
    render(
      <PhotoSection target={{ spreadId: 'spread-2', frameId: 'frame-1' }} />,
    )
    expect(screen.queryByTestId('photo-remove')).toBeNull()
    expect(screen.getByTestId('inspector-photo-empty').textContent).toBe(
      'Empty — drag a photo',
    )
  })

  it('renders nothing for a stale target and follows book changes', () => {
    seed({ asset: { widthPx: 1000, heightPx: 1000 } })
    const { container, rerender } = render(
      <PhotoSection target={{ ...target, frameId: 'gone' }} />,
    )
    expect(container.textContent).toBe('')
    rerender(<PhotoSection target={target} />)
    expect(chip().textContent).toBe('254 ppi')
    act(() => {
      seed({ asset: { widthPx: 500, heightPx: 500 } })
    })
    expect(chip().textContent).toBe('127 ppi')
  })
})

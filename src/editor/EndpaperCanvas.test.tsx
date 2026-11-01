import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setEndpaperPhoto } from '../core/cover'
import { makeBookWithAsset } from '../core/testing/fixtures'
import * as tierCache from '../photo/tierCache'
import { resetBookStore } from './bookStore'
import { EndpaperCanvas } from './EndpaperCanvas'
import { EndpaperOverlay } from './EndpaperOverlay'
import { setEndpaperSelected } from './endpaperSelection'
import { maxDesiredTier, resetTierDisplay } from './tierDisplay'

const thumbs = vi.hoisted(() => new Map<string, string>())
vi.mock('./thumbCache', () => ({
  getThumbUrl: (id: string) => thumbs.get(id),
  subscribeThumb: () => () => undefined,
}))

function seed(withPhoto: boolean) {
  const book = makeBookWithAsset('a1', { place: false })
  resetBookStore({
    book: withPhoto ? setEndpaperPhoto(book, 'front', 'a1') : book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function stubTiers() {
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.spyOn(tierCache, 'getTierUrl').mockImplementation((id, tier) =>
    id === 'a1' && tier === 1280 ? 'blob:a1-1280' : undefined,
  )
  vi.spyOn(tierCache, 'subscribeTier').mockImplementation(() => () => undefined)
  return vi.spyOn(tierCache, 'requestTier').mockImplementation(() => undefined)
}

const pages = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>('.endpaper-page'),
]

describe('EndpaperCanvas tiers', () => {
  afterEach(() => {
    cleanup()
    act(() => {
      setEndpaperSelected(null)
    })
    thumbs.clear()
    resetBookStore()
    resetTierDisplay()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('the selected endpaper swaps both pages to the working preview; the list row stays on the thumb', async () => {
    const requestTier = stubTiers()
    thumbs.set('a1', 'blob:a1')
    seed(true)

    const row = render(<EndpaperCanvas side="front" mini />)
    expect(requestTier).not.toHaveBeenCalled()
    act(() => {
      setEndpaperSelected('front')
    })
    const overlay = render(<EndpaperOverlay />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const canvas = screen.getByTestId('canvas-endpaper')
    expect(pages(canvas)).toHaveLength(2)
    for (const page of pages(canvas)) {
      expect(page.style.backgroundImage).toContain('blob:a1-1280')
      expect(page.dataset.tier).toBe('1280')
    }
    expect(pages(row.container)).toHaveLength(2)
    for (const page of pages(row.container)) {
      expect(page.style.backgroundImage).toContain('blob:a1')
      expect(page.style.backgroundImage).not.toContain('1280')
      expect(page.hasAttribute('data-tier')).toBe(false)
    }
    overlay.unmount()
    expect(maxDesiredTier('a1')).toBeUndefined()
  })

  it('an endpaper without a photo keeps the pattern and requests no tier', () => {
    const requestTier = stubTiers()
    seed(false)
    act(() => {
      setEndpaperSelected('front')
    })
    render(<EndpaperOverlay />)
    expect(pages(screen.getByTestId('canvas-endpaper'))).toHaveLength(2)
    for (const page of pages(screen.getByTestId('canvas-endpaper'))) {
      expect(page.style.backgroundImage).toBe('')
      expect(page.hasAttribute('data-tier')).toBe(false)
    }
    expect(requestTier).not.toHaveBeenCalled()
  })
})

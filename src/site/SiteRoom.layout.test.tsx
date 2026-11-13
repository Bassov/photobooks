import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteRoom } from './SiteRoom'
import { bookInput, id, px, stubBox } from './siteRoom.test-helpers'

// Where the room puts the reader and its rows for a box (R = 2 · trim w / h:
// alps 380 / 230, sea 560 / 210, lake 2).

const gl = vi.hoisted(() => ({ wanted: false }))
vi.mock('./book/gl/three', async (real) => ({
  ...(await real<typeof import('./book/gl/three')>()),
  glWanted: () => gl.wanted,
}))
vi.mock('./book/roomGl', () => ({
  openReaderGl: () => new Promise(() => undefined),
}))

const ALPS_R = 380 / 230

const reader = () => id('site-reader')
const parentOf = (testId: string) => id(testId)?.parentElement ?? null
const playClass = () => id('site-play')?.className

beforeEach(() => {
  gl.wanted = false
  window.history.replaceState(null, '', '/site.html?book=alps')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('desktop 1440 × 900', () => {
  beforeEach(() => {
    stubBox(1440, 900)
  })

  it('centres the CSS reader under the head, the foot row at h − 54 on the grid', () => {
    render(<SiteRoom input={bookInput()} />)

    // w = (900 − 54 − 44 − 64) · R = 738 R; top = (44 + 846) / 2 − 738 / 2
    expect(px(reader(), 'left')).toBeCloseTo((1440 - 738 * ALPS_R) / 2, 6)
    expect(px(reader(), 'top')).toBeCloseTo(76, 6)
    // col = (1440 − 224) / 12; columns 0–3 about, 4–7 pager, 9–11 actions
    const about = parentOf('site-about')
    expect(px(about, 'left')).toBe(24)
    expect(px(about, 'top')).toBe(846)
    expect(px(about, 'width')).toBeCloseTo(453.333, 3)
    expect(px(about, 'height')).toBe(44)
    const pager = id('site-pager')
    expect(px(pager, 'left')).toBeCloseTo(493.333, 3)
    expect(px(pager, 'width')).toBeCloseTo(453.333, 3)
    expect(px(pager, 'top')).toBe(846)
    expect(px(pager, 'gap')).toBe(40)
    const actions = id('site-actions')
    expect(px(actions, 'left')).toBe(1080)
    expect(px(actions, 'width')).toBe(336)
    expect(px(actions, 'top')).toBe(846)
    expect(playClass()).toBe('t16 sb-play')
  })

  it.each([
    // the visible GL book (kx, ky, ty, dx) centred in [44, 846]
    ['alps', 'portrait', 2.4245, 7.8983],
    ['sea', 'landscape', -4.1314, 173.6135],
    ['lake', 'square', -24.9062, 70.2758],
  ])(
    'sizes the GL reader to the visible %s (%s) book',
    (book, _, left, top) => {
      gl.wanted = true
      window.history.replaceState(null, '', `/site.html?book=${book}`)

      render(<SiteRoom input={bookInput(book)} />)

      expect(px(reader(), 'left')).toBeCloseTo(left, 3)
      expect(px(reader(), 'top')).toBeCloseTo(top, 3)
    },
  )

  it('keeps the whole-box layout for a host-drawn book even with GL', () => {
    gl.wanted = true

    render(<SiteRoom input={bookInput()} renderSlide={() => null} />)

    expect(px(reader(), 'top')).toBeCloseTo(76, 6)
  })
})

describe('narrow desktop', () => {
  it('stacks the pager 24 under the book, then about and the buttons 16 under it', () => {
    stubBox(620, 560)
    gl.wanted = true

    render(<SiteRoom input={bookInput()} />)

    // four columns: (620 − 32 − 36) / 4 · 4 + 36 = 588 (under 392 R)
    const H = 588 / ALPS_R
    const top = 64 + (392 - H) / 2
    expect(px(reader(), 'left')).toBe(16)
    expect(px(reader(), 'top')).toBeCloseTo(top, 6)
    const pager = id('site-pager')
    expect(px(pager, 'top')).toBeCloseTo(top + H + 24, 6)
    expect(px(pager, 'left')).toBe(16)
    expect(px(pager, 'right')).toBe(16)
    expect(px(pager, 'gap')).toBe(24)
    const actions = id('site-actions')
    expect(px(actions, 'top')).toBeCloseTo(top + H + 24 + 60, 6)
    expect(px(actions, 'left')).toBe(16)
    expect(px(actions, 'right')).toBe(16)
    expect(px(actions, 'gap')).toBe(16)
    expect(px(actions, 'height')).toBe(44)
    expect(px(parentOf('site-play'), 'gap')).toBe(24)
    expect(playClass()).toBe('m15 sb-play')
  })

  it.each([
    [640, 'm15 sb-play', 'site-about'],
    [641, 't16 sb-play', 'site-share'],
  ])(
    'at %i px wide reads %s, the actions row opening with %s',
    (w, cls, first) => {
      stubBox(w, 560)

      render(<SiteRoom input={bookInput()} />)

      expect(playClass()).toBe(cls)
      expect(
        id('site-actions')?.firstElementChild?.getAttribute('data-testid'),
      ).toBe(first)
    },
  )
})

describe('phone landscape', () => {
  it('puts the rows beside a wide short book (844 × 390)', () => {
    stubBox(844, 390)

    render(<SiteRoom input={bookInput()} />)

    // side: min(844 − 272, 366 R) = 572 beats foot min(812, 326 R)
    expect(id('site-room')?.getAttribute('data-layout')).toBe('side')
    expect(px(reader(), 'left')).toBe(136)
    expect(px(reader(), 'top')).toBeCloseTo((390 - 572 / ALPS_R) / 2, 6)
    const all = id('site-all-books')
    expect(all?.style.position).toBe('absolute')
    expect(px(all, 'left')).toBe(16)
    expect(px(all, 'top')).toBe(8)
    expect(px(all, 'max-width')).toBe(112)
    const buttons = parentOf('site-play')
    expect(px(buttons, 'right')).toBe(16)
    expect(px(buttons, 'top')).toBe(8)
    expect(px(buttons, 'gap')).toBe(20)
    expect(px(buttons, 'height')).toBe(44)
    const lbl = parentOf('site-label')
    expect(px(lbl, 'left')).toBe(16)
    expect(px(lbl, 'top')).toBe(338)
    expect(px(lbl, 'height')).toBe(44)
    expect(playClass()).toBe('m15 sb-play')
  })

  it('puts one foot row under a narrow book (480 × 470)', () => {
    stubBox(480, 470)

    render(<SiteRoom input={bookInput()} />)

    // foot: min(448, 406 R) = 448 beats side min(208, 446 R)
    expect(id('site-room')?.getAttribute('data-layout')).toBe('foot')
    expect(px(reader(), 'left')).toBe(16)
    expect(px(reader(), 'top')).toBeCloseTo(8 + (406 - 448 / ALPS_R) / 2, 6)
    const foot = parentOf('site-play')?.parentElement ?? null
    expect(foot?.style.display).toBe('grid')
    expect(px(foot, 'top')).toBe(418)
    expect(px(foot, 'height')).toBe(44)
    expect(id('site-all-books')?.style.justifySelf).toBe('start')
    expect(id('site-all-books')?.style.maxWidth).toBe('100%')
    expect(px(parentOf('site-label'), 'gap')).toBe(24)
    expect(parentOf('site-play')?.style.justifySelf).toBe('end')
    expect(px(parentOf('site-play'), 'gap')).toBe(20)
  })
})

describe('phone portrait', () => {
  it('puts the back row above the page and the label under it (390 × 844)', () => {
    stubBox(390, 844)

    render(<SiteRoom input={bookInput()} />)

    // page: min(358, 672 · R / 2) = 358 wide; the head row centres the block
    const ph = 358 / (ALPS_R / 2)
    const gt = 8 + (844 - 72 - (ph + 84)) / 2
    const head = parentOf('site-all-books')
    expect(px(head, 'top')).toBeCloseTo(gt, 6)
    expect(px(head, 'left')).toBe(16)
    expect(px(head, 'right')).toBe(16)
    expect(px(head, 'height')).toBe(44)
    expect(px(head, 'gap')).toBe(20)
    expect(id('site-all-books')?.style.display).toBe('flex')
    expect(px(parentOf('site-play'), 'gap')).toBe(20)
    expect(px(parentOf('site-play'), 'height')).toBe(44)
    const foot = parentOf('site-label')
    expect(px(foot, 'top')).toBeCloseTo(gt + 52 + ph + 8, 6)
    expect(px(foot, 'left')).toBe(16)
    expect(px(foot, 'height')).toBe(24)
    expect(playClass()).toBe('m15 sb-play')
  })
})

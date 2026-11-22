import { afterEach, describe, expect, it, vi } from 'vitest'
import { bookDpiThresholds } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { countLowResAssets } from './pageFillLowRes'

// Every real count reads the print-profile thresholds once, so the spy
// counts recounts and tells a cached answer from a fresh one.
vi.mock('../core', async (importOriginal) => {
  const core = await importOriginal<typeof import('../core')>()
  return { ...core, bookDpiThresholds: vi.fn(core.bookDpiThresholds) }
})

const thresholds = vi.mocked(bookDpiThresholds)

/** 19 × 23 cm book: 100 px is low-res, 2200 px (≈ 243 ppi) is not. */
function seed(sides: Record<string, number>): readonly string[] {
  resetBookStore()
  const snap = getBookStoreSnapshot()
  const ids = Object.keys(sides)
  const assets = Object.fromEntries(
    ids.map((id) => [id, { widthPx: sides[id], heightPx: sides[id] }]),
  )
  resetBookStore({
    book: {
      ...snap.book,
      settings: {
        ...snap.book.settings,
        trim: { widthMm: 190, heightMm: 230 },
      },
      assets,
      gallery: ids,
    },
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
  return getBookStoreSnapshot().book.gallery
}

describe('countLowResAssets (P11 header count)', () => {
  afterEach(() => {
    resetBookStore()
    thresholds.mockClear()
  })

  it('counts with the chip predicate and reuses the answer while its inputs stand', () => {
    const ids = seed({ a: 100, b: 2200, c: 100 })
    thresholds.mockClear()
    expect(countLowResAssets(ids)).toBe(2)
    expect(countLowResAssets(ids)).toBe(2)
    expect(thresholds).toHaveBeenCalledTimes(1)
  })

  it('recounts for another id list, even with the same ids', () => {
    const ids = seed({ a: 100, b: 2200 })
    expect(countLowResAssets(ids)).toBe(1)
    thresholds.mockClear()
    expect(countLowResAssets(['b'])).toBe(0)
    expect(countLowResAssets([...ids])).toBe(1)
    expect(thresholds).toHaveBeenCalledTimes(2)
  })

  it('recounts when only the trim changes', () => {
    const ids = seed({ a: 100, b: 2200 })
    expect(countLowResAssets(ids)).toBe(1)
    // A4 pages: 2200 px ≈ 188 ppi.
    dispatchBookOp({ type: 'setTrim', widthMm: 210, heightMm: 297 })
    expect(countLowResAssets(ids)).toBe(2)
  })

  it('recounts when only the session pixel sizes change', () => {
    const ids = seed({ a: 100, b: 2200 })
    expect(countLowResAssets(ids)).toBe(1)
    const snap = getBookStoreSnapshot()
    resetBookStore({
      ...snap,
      sessionMeta: new Map([
        [
          'a',
          {
            name: 'a',
            correctedWidth: 2200,
            correctedHeight: 2200,
            orientation: 1,
            aspect: 1,
          },
        ],
      ]),
    })
    expect(countLowResAssets(ids)).toBe(0)
  })
})

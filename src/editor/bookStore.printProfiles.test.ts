import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPrintProfile } from '../core'
import {
  makeBook,
  makeCustomPrintProfile,
  makeSpread,
} from '../core/testing/fixtures'
import {
  getBookPrintProfiles,
  getSpreadPaintSnapshot,
  resetBookStore,
  setBookPrintProfiles,
  subscribeBookStore,
  subscribeSpread,
} from './bookStore'

const CUSTOM = makeCustomPrintProfile()

function seed() {
  resetBookStore({
    book: setPrintProfile(
      makeBook({ spreads: [makeSpread({ id: 's1' })] }),
      CUSTOM.id,
      [CUSTOM],
    ),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

afterEach(() => {
  setBookPrintProfiles([])
  resetBookStore()
})

describe('bookStore print profiles (low-res gates)', () => {
  it('repaints spreads when the library profile changes the DPI gates', () => {
    seed()
    const before = getSpreadPaintSnapshot('s1')
    const spread = vi.fn()
    const store = vi.fn()
    const stopSpread = subscribeSpread('s1', spread)
    const stopStore = subscribeBookStore(store)
    setBookPrintProfiles([{ ...CUSTOM, dpi: { warn: 120, min: 60 } }])
    expect(getBookPrintProfiles()[0]?.dpi.warn).toBe(120)
    expect(spread).toHaveBeenCalled()
    expect(store).toHaveBeenCalled()
    expect(getSpreadPaintSnapshot('s1')).not.toBe(before)
    stopSpread()
    stopStore()
  })

  it('keeps the paint when the gates stay the same', () => {
    seed()
    const before = getSpreadPaintSnapshot('s1')
    const store = vi.fn()
    const stop = subscribeBookStore(store)
    setBookPrintProfiles([{ ...CUSTOM, name: 'Renamed' }])
    expect(store).not.toHaveBeenCalled()
    expect(getSpreadPaintSnapshot('s1')).toBe(before)
    stop()
  })
})

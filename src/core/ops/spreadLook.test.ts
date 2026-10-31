import { describe, expect, it } from 'vitest'
import { parseBook } from '../parse'
import { makeBook, makeSpread } from '../testing/fixtures'
import { applyBookOp } from './applyBookOp'
import { setSpreadBackground, setSpreadMaster } from './spreadLook'

const book = () =>
  makeBook({ spreads: [makeSpread({ id: 'a' }), makeSpread({ id: 'b' })] })

describe('setSpreadBackground', () => {
  it('sets one spread’s color and clears it back to the page default', () => {
    const start = book()
    const dark = setSpreadBackground(start, 'a', '#2a2927')
    expect(dark.spreads[0]?.backgroundColor).toBe('#2a2927')
    expect(dark.spreads[1]).toBe(start.spreads[1])
    const cleared = setSpreadBackground(dark, 'a', undefined)
    expect(cleared.spreads[0]).toBeDefined()
    expect(cleared.spreads[0]).not.toHaveProperty('backgroundColor')
  })

  it('returns the same book for the same color or an unknown spread', () => {
    const dark = setSpreadBackground(book(), 'a', '#111111')
    expect(setSpreadBackground(dark, 'a', '#111111')).toBe(dark)
    expect(setSpreadBackground(dark, 'zzz', '#ffffff')).toBe(dark)
    const plain = book()
    expect(setSpreadBackground(plain, 'a', undefined)).toBe(plain)
  })

  it('is the setSpreadBackground book op', () => {
    const next = applyBookOp(book(), {
      type: 'setSpreadBackground',
      spreadId: 'b',
      color: '#f4f4f4',
    })
    expect(next.spreads[1]?.backgroundColor).toBe('#f4f4f4')
  })
})

describe('setSpreadMaster', () => {
  it('stores B / none and drops the field for the default Master A', () => {
    const start = book()
    const b = setSpreadMaster(start, 'a', 'B')
    expect(b.spreads[0]?.masterId).toBe('B')
    expect(b.spreads[1]).toBe(start.spreads[1])
    const none = setSpreadMaster(b, 'a', 'none')
    expect(none.spreads[0]?.masterId).toBe('none')
    const a = setSpreadMaster(none, 'a', 'A')
    expect(a.spreads[0]).toBeDefined()
    expect(a.spreads[0]).not.toHaveProperty('masterId')
  })

  it('returns the same book when the master does not change', () => {
    const start = book()
    expect(setSpreadMaster(start, 'a', 'A')).toBe(start)
    const b = setSpreadMaster(start, 'a', 'B')
    expect(setSpreadMaster(b, 'a', 'B')).toBe(b)
    expect(setSpreadMaster(b, 'zzz', 'none')).toBe(b)
  })

  it('is the setSpreadMaster book op and survives a save / load', () => {
    const next = applyBookOp(book(), {
      type: 'setSpreadMaster',
      spreadId: 'b',
      masterId: 'none',
    })
    const parsed = parseBook(JSON.parse(JSON.stringify(next)))
    expect(parsed.ok && parsed.book.spreads[1]?.masterId).toBe('none')
  })

  it('a stored unknown master is refused at load', () => {
    const bad = JSON.parse(JSON.stringify(book())) as {
      spreads: { masterId?: string }[]
    }
    bad.spreads[0] = { ...bad.spreads[0], masterId: 'C' }
    expect(parseBook(bad).ok).toBe(false)
  })
})

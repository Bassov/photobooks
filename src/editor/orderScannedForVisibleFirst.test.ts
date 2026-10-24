import { describe, expect, it } from 'vitest'
import type { ScannedEntry } from '../assets'
import { orderScannedForVisibleFirst } from './orderScannedForVisibleFirst'

function entry(relativePath: string): ScannedEntry {
  return { relativePath, byteSize: 1, mtimeMs: 1 }
}

describe('orderScannedForVisibleFirst', () => {
  it('returns a shallow copy when nothing is visible', () => {
    const scanned = [entry('a.jpg'), entry('b.jpg')]
    const ordered = orderScannedForVisibleFirst(scanned, new Set())
    expect(ordered).toEqual(scanned)
    expect(ordered).not.toBe(scanned)
    expect(ordered[0]).toBe(scanned[0])
  })

  it('moves visible paths ahead while preserving tier order', () => {
    const scanned = [entry('a.jpg'), entry('b.jpg'), entry('c.jpg')]
    const ordered = orderScannedForVisibleFirst(
      scanned,
      new Set(['c.jpg', 'a.jpg']),
    )
    expect(ordered.map((e) => e.relativePath)).toEqual([
      'a.jpg',
      'c.jpg',
      'b.jpg',
    ])
    expect(ordered).not.toBe(scanned)
  })

  it('keeps scanned order when visible paths miss every entry', () => {
    const scanned = [entry('a.jpg'), entry('b.jpg')]
    const ordered = orderScannedForVisibleFirst(
      scanned,
      new Set(['missing.jpg']),
    )
    expect(ordered.map((e) => e.relativePath)).toEqual(['a.jpg', 'b.jpg'])
  })
})

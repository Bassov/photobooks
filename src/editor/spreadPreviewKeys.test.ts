import { describe, expect, it } from 'vitest'
import {
  assetIdsOnSpread,
  thumbSnapshotFor,
  tierDisplayKeyFor,
  tierNumberFromKey,
  tierUrlFromKey,
} from './spreadPreviewKeys'

describe('spreadPreviewKeys', () => {
  it('dedupes asset ids and skips empty frames', () => {
    expect(
      assetIdsOnSpread([
        {},
        { assetId: 'a' },
        { assetId: 'b' },
        { assetId: 'a' },
      ]),
    ).toEqual(['a', 'b'])
    expect(assetIdsOnSpread([])).toEqual([])
  })

  it('builds thumb and tier display keys from per-spread assets only', () => {
    expect(thumbSnapshotFor([], () => 'x')).toBe('')
    expect(
      thumbSnapshotFor(['a', 'b'], (id) => (id === 'a' ? 'blob:a' : undefined)),
    ).toBe('a:blob:a|b:')

    const urls = new Map([
      ['a', { url: 'blob:tier-a', tier: 320 }],
      ['other', { url: 'blob:other', tier: 640 }],
    ])
    expect(tierDisplayKeyFor([], urls)).toBe('')
    expect(tierDisplayKeyFor(['a', 'b'], urls)).toBe('a:320:blob:tier-a|b:')
  })

  it('parses tier url and number from a display key', () => {
    const key = 'a:320:blob:tier-a|b:640:blob:tier-b'
    expect(tierUrlFromKey(key, 'a')).toBe('blob:tier-a')
    expect(tierUrlFromKey(key, 'b')).toBe('blob:tier-b')
    expect(tierUrlFromKey(key, 'missing')).toBeUndefined()
    expect(tierUrlFromKey('a:', 'a')).toBeUndefined()
    expect(tierUrlFromKey('a:320', 'a')).toBeUndefined()
    expect(tierUrlFromKey('a:320:', 'a')).toBeUndefined()

    expect(tierNumberFromKey(key, 'a')).toBe(320)
    expect(tierNumberFromKey(key, 'b')).toBe(640)
    expect(tierNumberFromKey(key, 'missing')).toBeUndefined()
    expect(tierNumberFromKey('a:', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a:nope:blob', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a:NaN:blob', 'a')).toBeUndefined()
  })
})

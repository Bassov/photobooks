import { describe, expect, it } from 'vitest'

import { decodeDerivedCacheEntry, encodeDerivedCacheEntry } from './envelope'

describe('derived cache envelope', () => {
  it('round-trips bytes and mime type', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer
    const encoded = encodeDerivedCacheEntry({
      bytes,
      mimeType: 'image/jpeg',
    })

    const decoded = decodeDerivedCacheEntry(encoded)
    expect(decoded?.mimeType).toBe('image/jpeg')
    expect(new Uint8Array(decoded?.bytes ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    )
  })

  it('rejects truncated buffers', () => {
    expect(decodeDerivedCacheEntry(new ArrayBuffer(2))).toBeUndefined()
  })

  it('rejects invalid mime length', () => {
    const buf = new ArrayBuffer(8)
    new DataView(buf).setUint32(0, 100, false)
    expect(decodeDerivedCacheEntry(buf)).toBeUndefined()
  })

  it('rejects empty mime and exact header-only buffers', () => {
    const emptyMime = new ArrayBuffer(4)
    new DataView(emptyMime).setUint32(0, 0, false)
    expect(decodeDerivedCacheEntry(emptyMime)).toBeUndefined()

    const headerOnly = new ArrayBuffer(4)
    new DataView(headerOnly).setUint32(0, 1, false)
    expect(decodeDerivedCacheEntry(headerOnly)).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { checkBookInvariants } from './index'
import assert from 'node:assert/strict'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from './testing/fixtures'

describe('checkBookInvariants', () => {
  it('accepts a consistent book', () => {
    expect(checkBookInvariants(makeBookWithAsset())).toEqual({ ok: true })
  })

  it('accepts empty frames without assetId', () => {
    expect(checkBookInvariants(makeBook())).toEqual({ ok: true })
  })

  it('rejects dangling frame asset', () => {
    const book = makeBook({
      assets: {},
      gallery: [],
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'missing' })] })],
    })
    const result = checkBookInvariants(book)
    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    expect(result.violation.code).toBe('dangling-frame-asset')
  })

  it('rejects placed asset missing from gallery', () => {
    const book = makeBook({
      assets: { 'asset-1': {} },
      gallery: [],
      spreads: [makeSpread({ frames: [makeFrame({ assetId: 'asset-1' })] })],
    })
    const result = checkBookInvariants(book)
    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    expect(result.violation.code).toBe('placed-not-in-gallery')
  })

  it('rejects gallery id missing from assets', () => {
    const book = makeBook({
      assets: {},
      gallery: ['ghost'],
    })
    const result = checkBookInvariants(book)
    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    expect(result.violation.code).toBe('gallery-missing-asset')
  })

  it('rejects duplicate gallery ids', () => {
    const book = makeBook({
      assets: { 'asset-1': {} },
      gallery: ['asset-1', 'asset-1'],
    })
    const result = checkBookInvariants(book)
    expect(result.ok).toBe(false)
    assert.equal(result.ok, false)
    expect(result.violation.code).toBe('duplicate-gallery-id')
  })
})

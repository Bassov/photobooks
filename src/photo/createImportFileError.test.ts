import { describe, expect, it } from 'vitest'
import { createImportFileError } from './assetPool'

describe('createImportFileError', () => {
  it('assigns a stable id, reason, and optional assetId', () => {
    const withAsset = createImportFileError({
      name: 'a.jpg',
      message: 'decode failed',
      reason: 'decode-failed',
      assetId: 'asset-1',
    })
    expect(withAsset.id.length).toBeGreaterThan(0)
    expect(withAsset).toMatchObject({
      name: 'a.jpg',
      message: 'decode failed',
      reason: 'decode-failed',
      assetId: 'asset-1',
    })
    const without = createImportFileError({
      name: 'b.tif',
      message: 'Unsupported',
      reason: 'unsupported-type',
    })
    expect(without.assetId).toBeUndefined()
    expect(Object.hasOwn(without, 'assetId')).toBe(false)
    expect(without.id).not.toBe(withAsset.id)
  })
})

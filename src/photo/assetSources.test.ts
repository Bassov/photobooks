import { afterEach, describe, expect, it } from 'vitest'
import { serializeBook } from '../core'
import { makeBook } from '../core/testing/fixtures'
import {
  assetSourceCovers,
  getAssetSource,
  releaseAssetSource,
  resetAssetSources,
  retainAssetSource,
} from './assetSources'

describe('assetSources', () => {
  afterEach(() => {
    resetAssetSources()
  })

  it('retains a session file that serializeBook does not contain', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'secret-name.jpg', {
      type: 'image/jpeg',
    })
    retainAssetSource('asset-1', file)

    const json = JSON.stringify(serializeBook(makeBook()))

    expect(getAssetSource('asset-1')).toBe(file)
    expect(json).not.toContain('secret-name')
    expect(json).not.toContain('asset-1')
  })

  it('does not mark an imported file as a covering source', () => {
    retainAssetSource('asset-1', new File([new Uint8Array([1])], 'a.jpg'))

    expect(assetSourceCovers('asset-1')).toBe(false)
    expect(assetSourceCovers('missing')).toBe(false)
  })

  it('releases a retained source so getAssetSource returns undefined', () => {
    retainAssetSource('asset-1', new File([new Uint8Array([1])], 'a.jpg'))
    releaseAssetSource('asset-1')
    expect(getAssetSource('asset-1')).toBeUndefined()
  })
})

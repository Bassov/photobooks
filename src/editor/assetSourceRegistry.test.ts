import { afterEach, describe, expect, it } from 'vitest'
import {
  clearRegisteredAssetSources,
  getRegisteredAssetSource,
  registerAssetSource,
} from './assetSourceRegistry'

describe('assetSourceRegistry', () => {
  afterEach(() => {
    clearRegisteredAssetSources()
  })

  it('registers, gets, and clears sources', () => {
    const source = {
      scanRoot: () => Promise.resolve({ ok: true as const, value: [] }),
      resolveFile: () =>
        Promise.resolve({ ok: false as const, code: 'not-found' as const }),
      readForHash: () =>
        Promise.resolve({ ok: false as const, code: 'not-found' as const }),
    }
    registerAssetSource('root-a', source)
    expect(getRegisteredAssetSource('root-a')).toBe(source)
    expect(getRegisteredAssetSource('missing')).toBeUndefined()
    clearRegisteredAssetSources()
    expect(getRegisteredAssetSource('root-a')).toBeUndefined()
  })
})

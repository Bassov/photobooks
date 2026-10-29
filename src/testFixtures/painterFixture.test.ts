import { afterEach, describe, expect, it } from 'vitest'
import { PAINTER_ASSET_IDS } from '../core/testing/painterFixture'
import { getBookStoreSnapshot, resetBookStore } from '../editor/bookStore'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import { loadPainterFixture } from './loadPainterFixture'
import { painterSourceFile } from './painterSourceFile'

afterEach(() => {
  resetAssetSources()
  resetBookStore()
})

describe('painterSourceFile', () => {
  it('builds a png session file for a painter asset', async () => {
    const file = painterSourceFile('painter-a')
    const bytes = new Uint8Array(await file.arrayBuffer())

    expect(file.type).toBe('image/png')
    expect(bytes[0]).toBe(137)
    expect(bytes[1]).toBe(80)
    expect(painterSourceFile('unknown-asset').type).toBe('image/png')
  })
})

describe('loadPainterFixture', () => {
  it('retains a session file for each painter fixture asset', () => {
    loadPainterFixture()

    for (const assetId of PAINTER_ASSET_IDS) {
      expect(getAssetSource(assetId)?.type).toBe('image/png')
    }
    expect(getBookStoreSnapshot().book.id).toBe('painter-fixture')
  })
})

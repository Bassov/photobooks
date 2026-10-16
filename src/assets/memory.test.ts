import { describe } from 'vitest'

import { runAssetSourceContract } from './assetSource.contract.test-helpers'
import { createMemoryAssetSource } from './index'

describe('createMemoryAssetSource', () => {
  runAssetSourceContract(() => {
    const source = createMemoryAssetSource()
    const rootId = 'root-memory'
    const relativePath = 'album/a.jpg'
    const fileBytes = new Uint8Array([1, 2, 3, 4]).buffer
    const mtimeMs = 1_700_000_000_000
    source.seedFile(rootId, relativePath, fileBytes, mtimeMs)
    return {
      source,
      rootId,
      relativePath,
      fileBytes,
      mtimeMs,
      setPermissionRequired: (required) => {
        source.setPermissionRequired(required)
      },
      seedCorrupted: (id, path) => {
        source.seedCorrupted(id, path)
      },
    }
  })
})

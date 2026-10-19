import { afterEach, beforeEach, describe } from 'vitest'

import { runAssetSourceContract } from './assetSource.contract.test-helpers'
import { createFsaAssetSource, createMemoryAssetDirectory } from './index'
import { resetScanWorker } from './scanClient'
import { stubScanWorker } from './scanWorkerMock.test-helpers'

describe('createFsaAssetSource', () => {
  beforeEach(() => {
    stubScanWorker()
  })

  afterEach(() => {
    resetScanWorker()
  })

  runAssetSourceContract(() => {
    const tree = createMemoryAssetDirectory()
    const rootId = 'root-fsa'
    const relativePath = 'album/a.jpg'
    const bytes = new Uint8Array([9, 8, 7, 6])
    const mtimeMs = 1_700_000_000_100
    tree.putFile(relativePath, bytes, mtimeMs)
    const source = createFsaAssetSource({ rootId, directory: tree.root })
    return {
      source,
      rootId,
      relativePath,
      fileBytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
      mtimeMs,
      setPermissionRequired: (required) => {
        source.setPermissionRequired(required)
      },
      seedCorrupted: (id, path) => {
        if (id !== rootId) {
          return
        }
        tree.putCorrupted(path)
      },
    }
  })
})

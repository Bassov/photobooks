import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runAssetSourceContract } from './assetSource.contract.test-helpers'
import { createMemoryAssetSource } from './index'
import { resetScanWorker } from './scanClient'
import { stubScanWorker } from './scanWorkerMock.test-helpers'

describe('createMemoryAssetSource', () => {
  beforeEach(() => {
    stubScanWorker()
  })

  afterEach(() => {
    resetScanWorker()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

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

  it('returns corrupted when the scan worker rejects', async () => {
    resetScanWorker()
    class FailWorker {
      private listeners = new Map<string, Set<(event: Event) => void>>()
      addEventListener(type: string, listener: (event: Event) => void): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(): void {
        const event = new ErrorEvent('error', { message: 'scan failed' })
        for (const listener of this.listeners.get('error') ?? []) {
          listener(event)
        }
      }
      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', FailWorker)

    const source = createMemoryAssetSource()
    source.seedFile('root', 'a.jpg', new Uint8Array([1]).buffer, 1)
    await expect(source.scanRoot('root')).resolves.toEqual({
      ok: false,
      code: 'corrupted',
    })
  })

  it('filters corrupted seeded files from scan and seeds missing roots', async () => {
    const source = createMemoryAssetSource()
    source.seedCorrupted('new-root', 'bad.jpg')
    source.seedFile('new-root', 'ok.jpg', new Uint8Array([1, 2]).buffer, 5)
    const scanned = await source.scanRoot('new-root')
    expect(scanned).toEqual({
      ok: true,
      value: [{ relativePath: 'ok.jpg', byteSize: 2, mtimeMs: 5 }],
    })
  })
})

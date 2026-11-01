import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  it('scan entries carry the walk File tagged with its relative path', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('album/a.jpg', new Uint8Array([1, 2, 3]), 7)
    const source = createFsaAssetSource({ rootId: 'r', directory: tree.root })

    const scanned = await source.scanRoot('r')

    const file = scanned.ok ? scanned.value[0]?.file : undefined
    expect(file).toBeInstanceOf(File)
    expect(file?.size).toBe(3)
    expect(file?.lastModified).toBe(7)
    expect(
      (file as File & { webkitRelativePath: string }).webkitRelativePath,
    ).toBe('album/a.jpg')
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

    const tree = createMemoryAssetDirectory()
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    await expect(source.scanRoot('root')).resolves.toEqual({
      ok: false,
      code: 'corrupted',
    })
  })

  it('returns not-found for empty relative paths and missing nested dirs', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('album/a.jpg', new Uint8Array([1]), 1)
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    await expect(source.readForHash('root', '')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(source.readForHash('root', '/')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(
      source.readForHash('root', 'missing/dir/a.jpg'),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(source.readForHash('root', 'nope.jpg')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(source.resolveFile('root', '')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(source.resolveFile('root', 'nope.jpg')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })
})

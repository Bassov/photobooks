import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetAssetPool } from '../photo/assetPool'
import {
  beginMetadataJob,
  endMetadataJob,
  resetPoolCoordination,
} from '../photo/poolCoordination'
import { computeSha256Hex } from './hashDigest'
import { hashContent } from './index'

const EMPTY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function mockHashWorker(): void {
  class MockWorker {
    private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(data: { id: string; buffer?: ArrayBuffer; file?: File }): void {
      void (async () => {
        let payload:
          | { id: string; ok: true; hash: string }
          | {
              id: string
              ok: false
              error: string
            }
        if (data.buffer) {
          const hash = await computeSha256Hex(data.buffer)
          payload = { id: data.id, ok: true, hash }
        } else {
          payload = {
            id: data.id,
            ok: true,
            hash: EMPTY_HASH,
          }
        }
        const event = { data: payload } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      })()
    }

    terminate(): void {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('Worker', MockWorker)
}

describe('hashContent', () => {
  afterEach(() => {
    resetAssetPool()
    resetPoolCoordination()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hashes through the worker pool', async () => {
    mockHashWorker()
    const hash = await hashContent(new ArrayBuffer(0))
    expect(hash).toBe(EMPTY_HASH)
  })

  it('waits for pending metadata before hashing', async () => {
    mockHashWorker()
    beginMetadataJob()
    let hashed = false
    const pending = hashContent(new ArrayBuffer(0)).then((hash) => {
      hashed = true
      return hash
    })
    await Promise.resolve()
    expect(hashed).toBe(false)
    endMetadataJob()
    await expect(pending).resolves.toBe(EMPTY_HASH)
    expect(hashed).toBe(true)
  })
})

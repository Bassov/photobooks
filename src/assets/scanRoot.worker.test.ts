import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssetDirectoryHandle } from './fsa/handles'
import {
  createFsaAssetSource,
  createMemoryAssetDirectory,
  createMemoryAssetSource,
} from './index'
import { resetScanWorker } from './scanClient'
import { finalizeMemoryScanEntries, walkAssetDirectory } from './scanWalk'
import type { ScannedEntry } from './types'

describe('scanRoot worker dispatch', () => {
  afterEach(() => {
    resetScanWorker()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('dispatches FSA scanRoot through Worker.postMessage and returns public entries', async () => {
    const posts: unknown[] = []
    class CountingWorker {
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

      postMessage(data: {
        id: string
        kind: 'directory'
        directory: AssetDirectoryHandle
      }): void {
        posts.push({ id: data.id, kind: data.kind })
        void walkAssetDirectory(data.directory).then((entries) => {
          const event = {
            data: { id: data.id, ok: true as const, entries },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CountingWorker)

    const tree = createMemoryAssetDirectory()
    tree.putFile('a.jpg', new Uint8Array([1]), 10)
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })

    const scanned = await source.scanRoot('root')
    expect(posts).toEqual([
      { id: expect.stringMatching(/^scan-/), kind: 'directory' },
    ])
    expect(scanned).toEqual({
      ok: true,
      value: [{ relativePath: 'a.jpg', byteSize: 1, mtimeMs: 10 }],
    })
  })

  it('dispatches memory scanRoot through Worker.postMessage and returns public entries', async () => {
    const posts: unknown[] = []
    class CountingWorker {
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

      postMessage(data: {
        id: string
        kind: 'memory-files'
        files: readonly {
          relativePath: string
          byteSize: number
          mtimeMs: number
        }[]
      }): void {
        posts.push({ id: data.id, kind: data.kind, files: data.files })
        const entries: ScannedEntry[] = finalizeMemoryScanEntries(data.files)
        const event = {
          data: { id: data.id, ok: true as const, entries },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CountingWorker)

    const source = createMemoryAssetSource()
    source.seedFile('root', 'b.jpg', new Uint8Array([2, 3]).buffer, 20)
    const scanned = await source.scanRoot('root')
    expect(posts).toEqual([
      {
        id: expect.stringMatching(/^scan-/),
        kind: 'memory-files',
        files: [{ relativePath: 'b.jpg', byteSize: 2, mtimeMs: 20 }],
      },
    ])
    expect(scanned).toEqual({
      ok: true,
      value: [{ relativePath: 'b.jpg', byteSize: 2, mtimeMs: 20 }],
    })
  })
})

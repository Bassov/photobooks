import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMemoryAssetDirectory } from './fsa/memoryDirectory'
import {
  resetScanWorker,
  scanDirectoryInWorker,
  scanMemoryFilesInWorker,
} from './scanClient'
import { walkAssetDirectory } from './scanWalk'

describe('scanClient', () => {
  afterEach(() => {
    resetScanWorker()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolves directory and memory-file scans from worker responses', async () => {
    class OkWorker {
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
        kind: 'directory' | 'memory-files'
        directory?: Parameters<typeof walkAssetDirectory>[0]
        files?: readonly {
          relativePath: string
          byteSize: number
          mtimeMs: number
        }[]
      }): void {
        void (async () => {
          const entries =
            data.kind === 'directory' && data.directory
              ? await walkAssetDirectory(data.directory)
              : [...(data.files ?? [])].sort((a, b) =>
                  a.relativePath.localeCompare(b.relativePath),
                )
          const event = {
            data: { id: data.id, ok: true as const, entries },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })()
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', OkWorker)

    const tree = createMemoryAssetDirectory()
    tree.putFile('z.jpg', new Uint8Array([1]), 3)
    tree.putFile('a.jpg', new Uint8Array([1, 2]), 1)
    await expect(scanDirectoryInWorker(tree.root)).resolves.toEqual([
      { relativePath: 'a.jpg', byteSize: 2, mtimeMs: 1 },
      { relativePath: 'z.jpg', byteSize: 1, mtimeMs: 3 },
    ])

    await expect(
      scanMemoryFilesInWorker([
        { relativePath: 'b.jpg', byteSize: 4, mtimeMs: 2 },
        { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      ]),
    ).resolves.toEqual([
      { relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      { relativePath: 'b.jpg', byteSize: 4, mtimeMs: 2 },
    ])
  })

  it('rejects when the worker returns ok:false', async () => {
    class FailWorker {
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

      postMessage(data: { id: string }): void {
        const event = {
          data: { id: data.id, ok: false as const, error: 'boom' },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', FailWorker)

    await expect(scanMemoryFilesInWorker([])).rejects.toThrow('boom')
  })

  it('rejects on worker error events', async () => {
    class ErrorWorker {
      private listeners = new Map<string, Set<(event: Event) => void>>()

      addEventListener(type: string, listener: (event: Event) => void): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: Event) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(): void {
        const event = new ErrorEvent('error', { message: 'worker crashed' })
        for (const listener of this.listeners.get('error') ?? []) {
          listener(event)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', ErrorWorker)

    await expect(scanMemoryFilesInWorker([])).rejects.toThrow('worker crashed')
  })

  it('rejects with fallback message when worker error has empty message', async () => {
    class EmptyErrorWorker {
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
        const event = new ErrorEvent('error', { message: '' })
        for (const listener of this.listeners.get('error') ?? []) {
          listener(event)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', EmptyErrorWorker)

    await expect(scanMemoryFilesInWorker([])).rejects.toThrow(
      'Scan worker failed',
    )
  })

  it('reuses one worker across scans and resets counter on resetScanWorker', async () => {
    let constructed = 0
    const ids: string[] = []
    class CountingWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()
      constructor() {
        constructed += 1
      }
      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(data: { id: string }): void {
        ids.push(data.id)
        const event = {
          data: { id: data.id, ok: true as const, entries: [] },
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

    await scanMemoryFilesInWorker([])
    await scanMemoryFilesInWorker([])
    expect(constructed).toBe(1)
    expect(ids).toEqual(['scan-1', 'scan-2'])

    resetScanWorker()
    await scanMemoryFilesInWorker([])
    expect(constructed).toBe(2)
    expect(ids[2]).toBe('scan-1')
  })

  it('ignores worker messages for other request ids', async () => {
    class MultiWorker {
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

      postMessage(data: { id: string }): void {
        const wrong = {
          data: {
            id: 'other-id',
            ok: true as const,
            entries: [{ relativePath: 'x', byteSize: 1, mtimeMs: 1 }],
          },
        } as MessageEvent
        const right = {
          data: { id: data.id, ok: true as const, entries: [] },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(wrong)
          listener(right)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', MultiWorker)

    await expect(scanMemoryFilesInWorker([])).resolves.toEqual([])
  })
})

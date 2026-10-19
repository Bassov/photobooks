import { vi } from 'vitest'

import type { AssetDirectoryHandle } from './fsa/handles'
import { finalizeMemoryScanEntries, walkAssetDirectory } from './scanWalk'
import type { ScannedEntry } from './types'

type ScanRequest =
  | {
      id: string
      kind: 'directory'
      directory: AssetDirectoryHandle
    }
  | {
      id: string
      kind: 'memory-files'
      files: readonly {
        relativePath: string
        byteSize: number
        mtimeMs: number
      }[]
    }

/**
 * Stub `Worker` so scanClient posts run walk/finalize in-process (same as a
 * real worker message handler) — production adapters never call walk on main.
 */
export function stubScanWorker(options?: { onWalk?: () => void }): {
  postMessageCount: () => number
} {
  let posts = 0
  class MockScanWorker {
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

    postMessage(data: ScanRequest): void {
      posts += 1
      void (async () => {
        try {
          let entries: ScannedEntry[]
          if (data.kind === 'directory') {
            options?.onWalk?.()
            entries = await walkAssetDirectory(data.directory)
          } else {
            options?.onWalk?.()
            entries = finalizeMemoryScanEntries(data.files)
          }
          const event = {
            data: { id: data.id, ok: true as const, entries },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Scan worker failed'
          const event = {
            data: { id: data.id, ok: false as const, error: message },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        }
      })()
    }

    terminate(): void {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('Worker', MockScanWorker)
  return {
    postMessageCount: () => posts,
  }
}

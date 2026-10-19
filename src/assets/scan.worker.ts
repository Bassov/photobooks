import type { AssetDirectoryHandle } from './fsa/handles'
import { finalizeMemoryScanEntries, walkAssetDirectory } from './scanWalk'
import type { ScannedEntry } from './types'

export type ScanWorkerRequest =
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

export type ScanWorkerResponse =
  | { id: string; ok: true; entries: ScannedEntry[] }
  | { id: string; ok: false; error: string }

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<ScanWorkerRequest>) => void) | null
  postMessage: (message: ScanWorkerResponse) => void
}

workerScope.onmessage = (event: MessageEvent<ScanWorkerRequest>) => {
  void (async () => {
    const request = event.data
    try {
      const entries =
        request.kind === 'directory'
          ? await walkAssetDirectory(request.directory)
          : finalizeMemoryScanEntries(request.files)
      workerScope.postMessage({ id: request.id, ok: true, entries })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Scan worker failed'
      workerScope.postMessage({ id: request.id, ok: false, error: message })
    }
  })()
}

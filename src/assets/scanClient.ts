import type { AssetDirectoryHandle } from './fsa/handles'
import type { ScanWorkerRequest, ScanWorkerResponse } from './scan.worker'
import type { ScannedEntry } from './types'

let scanWorker: Worker | undefined
let requestCounter = 0

function getScanWorker(): Worker {
  scanWorker ??= new Worker(new URL('./scan.worker.ts', import.meta.url), {
    type: 'module',
  })
  return scanWorker
}

/** Terminate the shared scan worker (tests / teardown). */
export function resetScanWorker(): void {
  scanWorker?.terminate()
  scanWorker = undefined
  requestCounter = 0
}

function requestScan(message: ScanWorkerRequest): Promise<ScannedEntry[]> {
  const worker = getScanWorker()
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<ScanWorkerResponse>) => {
      if (event.data.id !== message.id) {
        return
      }
      cleanup()
      if (!event.data.ok) {
        reject(new Error(event.data.error))
        return
      }
      resolve(event.data.entries)
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(event.message || 'Scan worker failed'))
    }
    const cleanup = (): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(message)
  })
}

function nextScanId(): string {
  return `scan-${String((requestCounter += 1))}`
}

/** Walk a directory handle inside the scan worker. */
export function scanDirectoryInWorker(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
): Promise<ScannedEntry[]> {
  return requestScan({
    id: nextScanId(),
    kind: 'directory',
    directory: directory as AssetDirectoryHandle,
  })
}

/** Finalize a memory file table inside the scan worker. */
export function scanMemoryFilesInWorker(
  files: readonly {
    relativePath: string
    byteSize: number
    mtimeMs: number
  }[],
): Promise<ScannedEntry[]> {
  return requestScan({ id: nextScanId(), kind: 'memory-files', files })
}

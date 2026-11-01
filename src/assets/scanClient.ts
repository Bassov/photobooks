import type { AssetDirectoryHandle } from './fsa/handles'
import type { ScanWorkerRequest, ScanWorkerResponse } from './scan.worker'
import { walkAssetDirectory } from './scanWalk'
import type { ScannedEntry, WalkedEntry } from './types'

function isDataCloneError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'DataCloneError'
}

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

/**
 * Walk a directory handle inside the scan worker.
 * Non-cloneable test doubles fall back to an in-process walk (not a permission
 * bypass — real FSA handles always take the worker path).
 */
export async function scanDirectoryInWorker(
  directory: AssetDirectoryHandle | FileSystemDirectoryHandle,
): Promise<WalkedEntry[]> {
  try {
    // Directory requests answer with walkAssetDirectory output (Files cloned).
    return (await requestScan({
      id: nextScanId(),
      kind: 'directory',
      directory: directory as AssetDirectoryHandle,
    })) as WalkedEntry[]
  } catch (error) {
    if (isDataCloneError(error)) {
      return walkAssetDirectory(directory)
    }
    throw error
  }
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

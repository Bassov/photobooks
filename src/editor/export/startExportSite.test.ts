import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook } from '../../core/testing/fixtures'
import { getDerivative, requestDerivatives } from '../../derivatives/pool'
import { getAssetSource } from '../../photo/assetSources'
import { createSiteExportWorker } from '../../site/export/createSiteExportWorker'
import type { SiteExportMessage } from '../../site/export/site-export.worker'
import { getRegisteredAssetSource } from '../assetSourceRegistry'
import { resetBookStore } from '../bookStore'
import { requestFolderWrite } from './exportSiteFolder'
import { runExportSite, type ExportSiteRunDeps } from './exportSiteRun'
import { exportSiteStore } from './exportSiteStore'
import { startExportSite } from './startExportSite'

vi.mock('./exportSiteRun', () => ({
  runExportSite: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../photo/assetSources', () => ({ getAssetSource: vi.fn() }))
vi.mock('../assetSourceRegistry', () => ({ getRegisteredAssetSource: vi.fn() }))
vi.mock('../../site/export/createSiteExportWorker', () => ({
  createSiteExportWorker: vi.fn(),
}))

const folder = { kind: 'directory', name: 'Site' } as FileSystemDirectoryHandle
const book = makeBook({ id: 'b1', title: 'Lake' })

/** Start an export and return what it hands to `runExportSite`. */
function start(): ExportSiteRunDeps {
  startExportSite(folder)
  const deps = vi.mocked(runExportSite).mock.calls.at(-1)?.[0]
  if (deps === undefined) {
    throw new Error('runExportSite was not called')
  }
  return deps
}

class FakeWorker {
  onmessage: ((event: MessageEvent<SiteExportMessage>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  send(data: SiteExportMessage): void {
    this.onmessage?.({ data } as MessageEvent<SiteExportMessage>)
  }
}

function runWith(worker: FakeWorker) {
  vi.mocked(createSiteExportWorker).mockReturnValue(worker as unknown as Worker)
  const onMessage = vi.fn()
  const transfer = [new ArrayBuffer(4)]
  const request = { folder, input: {} } as unknown as Parameters<
    ExportSiteRunDeps['runWorker']
  >[0]
  start().runWorker(request, transfer, onMessage)
  return { onMessage, request, transfer }
}

beforeEach(() => {
  vi.mocked(runExportSite).mockClear()
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  resetBookStore()
})

describe('startExportSite', () => {
  it('runs the export of the open book into the folder with the app services', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234)

    const deps = start()

    expect(deps.book).toBe(book)
    expect(deps.storage).toBeNull()
    expect(deps.folder).toBe(folder)
    expect(deps.now()).toBe(1_234)
    expect(deps.requestWrite).toBe(requestFolderWrite)
    expect(deps.dispatch).toBe(exportSiteStore.dispatch)
    expect(deps.derivatives.request).toBe(requestDerivatives)
    expect(deps.derivatives.get).toBe(getDerivative)
    vi.restoreAllMocks()
  })

  it('reads a photo from the session file first', async () => {
    const file = new File(['x'], 'a.jpg')
    vi.mocked(getAssetSource).mockReturnValueOnce(file)

    const blob = await start().derivatives.readSource('a', {
      sourceRootId: 'root',
      relativePath: 'a.jpg',
    })

    expect(blob).toBe(file)
    expect(getRegisteredAssetSource).not.toHaveBeenCalled()
  })

  it('reads a photo from its registered folder, else fails', async () => {
    const file = new File(['y'], 'b.jpg')
    const resolveFile = vi.fn((_root: string, path: string) =>
      Promise.resolve(
        path === 'b.jpg'
          ? { ok: true as const, value: file }
          : { ok: false as const, code: 'not-found' as const },
      ),
    )
    vi.mocked(getRegisteredAssetSource).mockReturnValue({
      resolveFile,
    } as unknown as ReturnType<typeof getRegisteredAssetSource>)
    const { readSource } = start().derivatives

    expect(
      await readSource('b', { sourceRootId: 'root', relativePath: 'b.jpg' }),
    ).toBe(file)
    expect(resolveFile).toHaveBeenCalledWith('root', 'b.jpg')
    expect(getRegisteredAssetSource).toHaveBeenCalledWith('root')
    await expect(
      readSource('c', { sourceRootId: 'root', relativePath: 'c.jpg' }),
    ).rejects.toThrow('Photo source unavailable')
    await expect(readSource('d', { sourceRootId: 'root' })).rejects.toThrow(
      'Photo source unavailable',
    )
    await expect(readSource('e', { relativePath: 'b.jpg' })).rejects.toThrow(
      'Photo source unavailable',
    )
    vi.mocked(getRegisteredAssetSource).mockReset()
  })

  it('posts the request with its transfers and keeps the worker for progress', () => {
    const worker = new FakeWorker()
    const { onMessage, request, transfer } = runWith(worker)

    expect(worker.postMessage).toHaveBeenCalledWith(request, transfer)
    worker.send({ phase: 'write', done: 1, total: 2 })

    expect(onMessage).toHaveBeenCalledWith({
      phase: 'write',
      done: 1,
      total: 2,
    })
    expect(worker.terminate).not.toHaveBeenCalled()
  })

  it('ends the worker on its last message', () => {
    const worker = new FakeWorker()
    const { onMessage } = runWith(worker)
    const last = { failed: { code: 'quota' } } as SiteExportMessage

    worker.send(last)

    expect(onMessage).toHaveBeenCalledWith(last)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('reports a worker error as an unknown failure and ends the worker', () => {
    const worker = new FakeWorker()
    const { onMessage } = runWith(worker)

    worker.onerror?.()

    expect(onMessage).toHaveBeenCalledWith({ failed: { code: 'unknown' } })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})

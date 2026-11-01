import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPendingRetryAssetIdsForTests,
  getQueuedDecodeAssetIds,
  processAsset,
  resetAssetPool,
  runImportBatch,
  setVisibleAssetIds,
  warmAssetPool,
  type AssetProcessResult,
} from './assetPool'
import { PREVIEW_MAX_EDGE } from './photoEdges'
import type { PhotoWorkerRequest } from './processPhoto'

/** Fake decode worker: replies only when the test calls `reply(id)`. */
class ManualWorker {
  static instances: ManualWorker[] = []
  readonly posted: PhotoWorkerRequest[] = []
  /** Requests posted but not yet answered (a real worker decodes them all). */
  readonly open = new Set<string>()
  maxOpen = 0
  private readonly listeners = new Set<(event: MessageEvent) => void>()
  private readonly errorListeners = new Set<unknown>()

  constructor() {
    ManualWorker.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.add(listener)
    } else {
      this.errorListeners.add(listener)
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.delete(listener)
    } else {
      this.errorListeners.delete(listener)
    }
  }

  /** Message + error listeners still attached (0 once every job let go). */
  listenerCount(): number {
    return this.listeners.size + this.errorListeners.size
  }

  postMessage(request: PhotoWorkerRequest): void {
    this.posted.push(request)
    this.open.add(request.id)
    this.maxOpen = Math.max(this.maxOpen, this.open.size)
  }

  reply(id: string): void {
    this.open.delete(id)
    const event = {
      data: {
        id,
        ok: true,
        name: 'x.png',
        mimeType: 'image/png',
        byteLength: 1,
        width: 1,
        height: 1,
        correctedWidth: 1,
        correctedHeight: 1,
        orientation: 1,
        previewBuffer: new Uint8Array([7]).buffer,
        previewMimeType: 'image/webp',
      },
    } as MessageEvent
    for (const listener of [...this.listeners]) {
      listener(event)
    }
  }

  terminate(): void {
    this.listeners.clear()
  }
}

function onlyWorker(): ManualWorker {
  expect(ManualWorker.instances).toHaveLength(1)
  const [worker] = ManualWorker.instances
  if (worker === undefined) {
    throw new Error('no worker')
  }
  return worker
}

function postedIds(worker: ManualWorker): string[] {
  return worker.posted.map((request) => request.file.name)
}

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/png' })
}

function lastRequestId(worker: ManualWorker): string {
  const request = worker.posted.at(-1)
  if (request === undefined) {
    throw new Error('nothing posted')
  }
  return request.id
}

describe('assetPool in-flight decode across aborts', () => {
  beforeEach(() => {
    ManualWorker.instances = []
    // Two cores → one decode worker: every second job must wait for the slot.
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    })
    vi.stubGlobal('Worker', ManualWorker)
    warmAssetPool()
  })

  afterEach(() => {
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the slot busy after a caller abort until the worker replies', async () => {
    const worker = onlyWorker()
    const controller = new AbortController()
    setVisibleAssetIds(['zoomed', 'next'])
    const zoom = processAsset({
      assetId: 'zoomed',
      file: png('zoomed.png'),
      priority: 'zoom',
      maxEdge: PREVIEW_MAX_EDGE,
      dualTiers: true,
      signal: controller.signal,
    })
    const abortedId = lastRequestId(worker)
    const next = processAsset({
      assetId: 'next',
      file: png('next.png'),
      priority: 'visible',
    })

    controller.abort()

    await expect(zoom).rejects.toMatchObject({ name: 'AbortError' })
    expect(postedIds(worker)).toEqual(['zoomed.png'])
    expect(getQueuedDecodeAssetIds()).toEqual(['next'])

    worker.reply(abortedId)

    expect(postedIds(worker)).toEqual(['zoomed.png', 'next.png'])
    worker.reply(lastRequestId(worker))
    await expect(next).resolves.toMatchObject({ assetId: 'next' })
    expect(worker.maxOpen).toBe(1)
  })

  it('aborts an in-flight 1280 job on leave-now and frees the slot on reply', async () => {
    const worker = onlyWorker()
    setVisibleAssetIds(['big', 'next'])
    const big = processAsset({
      assetId: 'big',
      file: png('big.png'),
      priority: 'visible',
      maxEdge: PREVIEW_MAX_EDGE,
    })
    const bigId = lastRequestId(worker)
    const next = processAsset({
      assetId: 'next',
      file: png('next.png'),
      priority: 'visible',
    })

    setVisibleAssetIds(['next'])

    await expect(big).rejects.toMatchObject({ name: 'AbortError' })
    expect(getPendingRetryAssetIdsForTests()).toEqual(['big'])
    expect(postedIds(worker)).toEqual(['big.png'])

    worker.reply(bigId)

    // The late reply is discarded: the retry seed for re-entry survives it.
    expect(getPendingRetryAssetIdsForTests()).toEqual(['big'])
    expect(postedIds(worker)).toEqual(['big.png', 'next.png'])
    worker.reply(lastRequestId(worker))
    await expect(next).resolves.toMatchObject({ assetId: 'next' })
    expect(worker.maxOpen).toBe(1)
    expect(worker.listenerCount()).toBe(0)
  })

  it('still rejects a caller abort of an in-flight thumb after another asset left now', async () => {
    const worker = onlyWorker()
    const controller = new AbortController()
    setVisibleAssetIds(['stays', 'goes'])
    const thumb = processAsset({
      assetId: 'stays',
      file: png('stays.png'),
      priority: 'visible',
      signal: controller.signal,
    })

    setVisibleAssetIds(['stays'])
    controller.abort()

    await expect(thumb).rejects.toMatchObject({ name: 'AbortError' })
    expect(postedIds(worker)).toEqual(['stays.png'])
  })

  it('keeps an in-flight thumb whose asset left now and publishes it', async () => {
    const worker = onlyWorker()
    const published: AssetProcessResult[] = []
    setVisibleAssetIds(['kept'])
    const batch = runImportBatch([{ assetId: 'kept', file: png('kept.png') }], {
      priority: 'visible',
      onResult: (result) => published.push(result),
    })
    expect(postedIds(worker)).toEqual(['kept.png'])

    setVisibleAssetIds([])
    worker.reply(lastRequestId(worker))

    const outcome = await batch
    expect(published.map((result) => result.assetId)).toEqual(['kept'])
    expect(outcome.results.map((result) => result.assetId)).toEqual(['kept'])
    expect(outcome.errors).toEqual([])
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
  })

  it('a thumb kept through leave-now ignores a later caller abort', async () => {
    const worker = onlyWorker()
    const controller = new AbortController()
    setVisibleAssetIds(['kept'])
    const thumb = processAsset({
      assetId: 'kept',
      file: png('kept.png'),
      priority: 'zoom',
      signal: controller.signal,
    })

    setVisibleAssetIds([])
    controller.abort()
    worker.reply(lastRequestId(worker))

    await expect(thumb).resolves.toMatchObject({ assetId: 'kept' })
    expect(worker.listenerCount()).toBe(0)
  })

  it('drops queued off-now thumbs, keeps the in-flight one, re-enqueues on return', async () => {
    const worker = onlyWorker()
    setVisibleAssetIds(['first', 'second'])
    const first = processAsset({
      assetId: 'first',
      file: png('first.png'),
      priority: 'visible',
    })
    const firstId = lastRequestId(worker)
    const second = processAsset({
      assetId: 'second',
      file: png('second.png'),
      priority: 'visible',
    })
    expect(getQueuedDecodeAssetIds()).toEqual(['second'])

    setVisibleAssetIds([])

    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    expect(getQueuedDecodeAssetIds()).toEqual([])
    expect(getPendingRetryAssetIdsForTests()).toEqual(['second'])

    // Re-entry while the slot still decodes `first`: no duplicate for `first`,
    // `second` goes back on the now lane ahead of background work.
    void processAsset({
      assetId: 'later',
      file: png('later.png'),
      priority: 'background',
    })
    setVisibleAssetIds(['first', 'second'])
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
    expect(postedIds(worker)).toEqual(['first.png'])

    worker.reply(firstId)

    await expect(first).resolves.toMatchObject({ assetId: 'first' })
    expect(postedIds(worker)).toEqual(['first.png', 'second.png'])
    expect(worker.maxOpen).toBe(1)
  })
})

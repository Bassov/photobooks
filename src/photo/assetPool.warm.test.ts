import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDeferredLazyAssetIds,
  getQueuedDecodeAssetIds,
  hasDeferredLazyDecode,
  noteDecodeScrollActivity,
  processAsset,
  promoteDeferredLazyToWarm,
  resetAssetPool,
  setDecodeBackgroundIdleForTests,
  setVisibleAssetIds,
  warmAssetPool,
} from './assetPool'
import { resetDecodeScrollQuietForTests } from './decodeScrollQuiet'
import type { PhotoWorkerRequest } from './processPhoto'

/** Fake decode worker: replies only when the test calls `reply(id)`. */
class ManualWorker {
  static instances: ManualWorker[] = []
  readonly posted: PhotoWorkerRequest[] = []
  private readonly listeners = new Set<(event: MessageEvent) => void>()

  constructor() {
    ManualWorker.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.add(listener)
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.delete(listener)
    }
  }

  postMessage(request: PhotoWorkerRequest): void {
    this.posted.push(request)
  }

  reply(id: string): void {
    const event = {
      data: {
        id,
        ok: true,
        name: 'x.jpg',
        mimeType: 'image/jpeg',
        byteLength: 1,
        width: 4,
        height: 2,
        correctedWidth: 4,
        correctedHeight: 2,
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

function allPosted(): PhotoWorkerRequest[] {
  return ManualWorker.instances.flatMap((worker) => worker.posted)
}

function postedNames(): string[] {
  return allPosted().map((request) => request.file.name)
}

function replyTo(name: string): void {
  for (const worker of ManualWorker.instances) {
    const request = worker.posted.find((entry) => entry.file.name === name)
    if (request !== undefined) {
      worker.reply(request.id)
      return
    }
  }
  throw new Error(`${name} was not posted`)
}

function jpeg(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8])], name, { type: 'image/jpeg' })
}

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/png' })
}

describe('assetPool background warm jobs', () => {
  beforeEach(() => {
    ManualWorker.instances = []
    // Four cores → three decode workers.
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 4,
    })
    vi.stubGlobal('Worker', ManualWorker)
    warmAssetPool()
    setVisibleAssetIds([])
  })

  afterEach(() => {
    resetAssetPool()
    resetDecodeScrollQuietForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('queues an off-now JPEG warm job on the background lane instead of deferring it', () => {
    void processAsset({ assetId: 'lazy', file: jpeg('lazy.jpg') })
    void processAsset({
      assetId: 'warm',
      file: jpeg('warm.jpg'),
      priority: 'background',
      backgroundWarm: true,
      noPoolRetry: true,
    })

    expect(getDeferredLazyAssetIds()).toEqual(['lazy'])
    expect(getQueuedDecodeAssetIds()).toEqual(['warm'])
    expect(postedNames()).toEqual([])

    setDecodeBackgroundIdleForTests(true)
    expect(postedNames()).toEqual(['warm.jpg'])
  })

  it('promotes an import-deferred JPEG and settles both owners with its result', async () => {
    const owner = processAsset({ assetId: 'deferred', file: jpeg('d.jpg') })
    expect(hasDeferredLazyDecode('deferred')).toBe(true)

    const promoted = promoteDeferredLazyToWarm('deferred')

    expect(promoted).toBeInstanceOf(Promise)
    expect(hasDeferredLazyDecode('deferred')).toBe(false)
    expect(getQueuedDecodeAssetIds()).toEqual(['deferred'])
    expect(promoteDeferredLazyToWarm('deferred')).toBeUndefined()
    setDecodeBackgroundIdleForTests(true)
    replyTo('d.jpg')
    const [fromOwner, fromWarm] = await Promise.all([owner, promoted])
    expect(fromOwner.assetId).toBe('deferred')
    expect(fromWarm).toBe(fromOwner)
  })

  it('promotion rejects both owners when the deferred signal is aborted', async () => {
    const controller = new AbortController()
    const owner = processAsset({
      assetId: 'gone',
      file: jpeg('g.jpg'),
      signal: controller.signal,
    })
    controller.abort()

    const promoted = promoteDeferredLazyToWarm('gone')

    await expect(promoted).rejects.toMatchObject({ name: 'AbortError' })
    await expect(owner).rejects.toMatchObject({ name: 'AbortError' })
    expect(getQueuedDecodeAssetIds()).toEqual([])
    setDecodeBackgroundIdleForTests(true)
    expect(postedNames()).toEqual([])
  })

  it('an asset that entered now is no longer promotable', () => {
    void processAsset({ assetId: 'seen', file: jpeg('s.jpg') })
    setVisibleAssetIds(['seen'])
    expect(postedNames()).toEqual(['s.jpg'])
    expect(promoteDeferredLazyToWarm('seen')).toBeUndefined()
  })

  it('starts one warm job while the filmstrip scrolls; other background work waits', async () => {
    vi.useFakeTimers()
    try {
      for (const name of ['w1', 'w2']) {
        void processAsset({
          assetId: name,
          file: jpeg(`${name}.jpg`),
          priority: 'background',
          backgroundWarm: true,
          noPoolRetry: true,
        })
      }
      void processAsset({ assetId: 'bg', file: png('bg.png') })
      noteDecodeScrollActivity(10_000)

      setDecodeBackgroundIdleForTests(true)
      expect(postedNames()).toEqual(['w1.jpg'])
      // Second warm job waits for the in-flight one even when idle fires again.
      setDecodeBackgroundIdleForTests(true)
      expect(postedNames()).toEqual(['w1.jpg'])

      replyTo('w1.jpg')
      await vi.advanceTimersByTimeAsync(0)
      expect(postedNames()).toEqual(['w1.jpg', 'w2.jpg'])
      expect(getQueuedDecodeAssetIds()).toEqual(['bg'])

      // Scroll quiet over: the idle cap takes the rest.
      resetDecodeScrollQuietForTests()
      setDecodeBackgroundIdleForTests(true)
      expect(postedNames()).toEqual(['w1.jpg', 'w2.jpg', 'bg.png'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('without warm jobs, scroll quiet keeps the background lane idle', () => {
    void processAsset({ assetId: 'bg', file: png('bg.png') })
    noteDecodeScrollActivity(10_000)
    setDecodeBackgroundIdleForTests(true)
    expect(postedNames()).toEqual([])
    expect(getQueuedDecodeAssetIds()).toEqual(['bg'])
  })
})

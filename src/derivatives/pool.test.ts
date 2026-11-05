import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDerivedCacheForTests } from '../assets/derivedCache/instance'
import { createMemoryDerivedCache } from '../assets/derivedCache/memory'
import type { DerivedCache } from '../assets/derivedCache/types'
import {
  noteDecodeScrollActivity,
  resetDecodeScrollQuietForTests,
} from '../photo/decodeScrollQuiet'
import {
  beginMetadataJob,
  endMetadataJob,
  resetPoolCoordination,
} from '../photo/poolCoordination'
import type {
  DerivativeWorkerRequest,
  DerivativeWorkerResponse,
} from './encode'
import { DERIVATIVE_PRESETS, presetCacheId } from './plan'
import {
  DERIVATIVE_GATE_RETRY_MS,
  exposeDerivativesTestApi,
  forgetDerivatives,
  getDerivative,
  requestDerivatives,
  resetDerivativePoolForTests,
  type DerivativeSourceRequest,
} from './pool'

const decodeQueue = vi.hoisted(() => ({ ids: [] as string[] }))

vi.mock('../photo/assetPool', () => ({
  getQueuedDecodeAssetIds: () => decodeQueue.ids,
}))

function encoded(request: DerivativeWorkerRequest): DerivativeWorkerResponse {
  return {
    id: request.id,
    ok: true,
    decodeMs: 7,
    outputs: request.presetIds.map((presetId) => {
      const preset = DERIVATIVE_PRESETS.find((p) => p.id === presetId)
      if (preset === undefined) {
        throw new Error(presetId)
      }
      return {
        presetId,
        cacheId: presetCacheId(preset),
        bytes: new TextEncoder().encode(presetId).buffer,
        mimeType: preset.mimeType,
        width: 10,
        height: 5,
        outputHash: `hash-${presetId}`,
        ms: 3,
      }
    }),
  }
}

/** Worker double: requests wait in `held` until `release` answers them. */
const worker = {
  posted: [] as DerivativeWorkerRequest[],
  held: [] as DerivativeWorkerRequest[],
  reply: encoded,
  instances: 0,
  terminated: 0,
  emit: undefined as ((type: string, data?: unknown) => void) | undefined,
  release(): void {
    for (const request of this.held.splice(0)) {
      this.emit?.('message', this.reply(request))
    }
  },
}

class MockWorker {
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>()

  constructor() {
    worker.instances += 1
    worker.emit = (type, data) => {
      for (const listener of this.listeners.get(type) ?? []) {
        listener({ data } as MessageEvent)
      }
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  postMessage(data: DerivativeWorkerRequest): void {
    worker.posted.push(data)
    worker.held.push(data)
  }

  terminate(): void {
    worker.terminated += 1
  }
}

function request(
  assetHash: string,
  presetIds?: string[],
): DerivativeSourceRequest & { readSource: ReturnType<typeof vi.fn> } {
  return {
    assetHash,
    ...(presetIds === undefined ? {} : { presetIds }),
    readSource: vi.fn(() => Promise.resolve(new Blob([assetHash]))),
  }
}

/** Let queued microtasks / cache I/O settle, then answer the worker. */
async function settleAndRelease(): Promise<void> {
  await vi.waitFor(() => {
    expect(worker.held.length).toBeGreaterThan(0)
  })
  worker.release()
}

let cache: DerivedCache

beforeEach(() => {
  cache = createMemoryDerivedCache()
  setDerivedCacheForTests(cache)
  vi.stubGlobal('Worker', MockWorker)
})

afterEach(() => {
  resetDerivativePoolForTests()
  setDerivedCacheForTests(undefined)
  resetPoolCoordination()
  resetDecodeScrollQuietForTests()
  decodeQueue.ids = []
  worker.posted = []
  worker.held = []
  worker.reply = encoded
  worker.instances = 0
  worker.terminated = 0
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('requestDerivatives', () => {
  it('encodes misses in the worker, caches them, then serves cache hits', async () => {
    const first = request('a', ['site-share', 'site-thumb'])

    const pending = requestDerivatives([first])
    await settleAndRelease()
    const results = await pending

    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0]?.presetIds).toEqual(['site-thumb', 'site-share'])
    expect(results).toEqual([
      {
        assetHash: 'a',
        presetId: 'site-thumb',
        cacheId: 'drv-site-thumb-480-webp-q80',
        cacheHit: false,
        ms: 3,
        decodeMs: 7,
        outputHash: 'hash-site-thumb',
        byteLength: 10,
        width: 10,
        height: 5,
      },
      expect.objectContaining({
        presetId: 'site-share',
        cacheHit: false,
        outputHash: 'hash-site-share',
      }),
    ])
    expect(await cache.has('a', 'drv-site-share-1600-jpeg-q90')).toBe(true)

    const again = request('a', ['site-thumb', 'site-share'])
    const before = performance.now()
    const hits = await requestDerivatives([again])
    const elapsed = performance.now() - before

    expect(again.readSource).not.toHaveBeenCalled()
    expect(worker.posted).toHaveLength(1)
    expect(hits.map((r) => [r.presetId, r.cacheHit])).toEqual([
      ['site-thumb', true],
      ['site-share', true],
    ])
    expect(
      hits.every(
        (r) => r.ms >= 0 && r.ms <= elapsed && r.outputHash === undefined,
      ),
    ).toBe(true)
  })

  it('ignores a worker reply for a request it no longer waits on', async () => {
    const pending = requestDerivatives([request('a', ['site-thumb'])])
    await vi.waitFor(() => {
      expect(worker.held).toHaveLength(1)
    })

    expect(() =>
      worker.emit?.('message', { id: 'drv-stale', ok: false, error: 'late' }),
    ).not.toThrow()
    worker.release()
    expect((await pending)[0]?.error).toBeUndefined()
  })

  it('reset drops a pending gate retry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    decodeQueue.ids = ['thumb-1']
    void requestDerivatives([request('a', ['site-thumb'])])
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)

    resetDerivativePoolForTests()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('encodes only the missing presets and keeps config order in results', async () => {
    await cache.put('a', 'drv-site-display-1600-webp-q85', {
      bytes: new ArrayBuffer(1),
      mimeType: 'image/webp',
    })

    const pending = requestDerivatives([request('a')])
    await settleAndRelease()
    const results = await pending

    expect(worker.posted[0]?.presetIds).toEqual([
      'site-thumb',
      'site-large',
      'site-share',
    ])
    expect(results.map((r) => [r.presetId, r.cacheHit])).toEqual([
      ['site-thumb', false],
      ['site-display', true],
      ['site-large', false],
      ['site-share', false],
    ])
  })

  it('runs one job at a time, assets in request order, and reuses the worker', async () => {
    const a = request('a', ['site-thumb'])
    const b = request('b', ['site-thumb'])

    const pending = requestDerivatives([b, a, b])
    await settleAndRelease()
    expect(worker.posted).toHaveLength(1)
    await settleAndRelease()
    const results = await pending

    expect(worker.posted.map((r) => r.id)).toEqual(['drv-1', 'drv-2'])
    expect(results.map((r) => r.assetHash)).toEqual(['b', 'a'])
    expect(b.readSource).toHaveBeenCalledTimes(1)
    expect(worker.instances).toBe(1)
  })

  it('waits behind queued decodes, metadata jobs and the scroll-quiet window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    decodeQueue.ids = ['thumb-1']
    beginMetadataJob()
    noteDecodeScrollActivity(60_000)

    const pending = requestDerivatives([request('a', ['site-thumb'])])
    await vi.advanceTimersByTimeAsync(DERIVATIVE_GATE_RETRY_MS * 2)
    expect(worker.posted).toHaveLength(0)

    decodeQueue.ids = []
    await vi.advanceTimersByTimeAsync(DERIVATIVE_GATE_RETRY_MS)
    expect(worker.posted).toHaveLength(0)

    endMetadataJob()
    await vi.advanceTimersByTimeAsync(DERIVATIVE_GATE_RETRY_MS)
    expect(worker.posted).toHaveLength(0)

    noteDecodeScrollActivity(0)
    await vi.advanceTimersByTimeAsync(DERIVATIVE_GATE_RETRY_MS - 1)
    expect(worker.posted).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(worker.posted).toHaveLength(1)

    worker.release()
    expect((await pending)[0]?.cacheHit).toBe(false)
  })

  it('reports worker failures per preset and caches nothing', async () => {
    worker.reply = (r) => ({
      id: r.id,
      ok: false,
      error: 'Derivative decode failed',
    })

    const pending = requestDerivatives([request('a', ['site-thumb'])])
    await settleAndRelease()

    expect(await pending).toEqual([
      {
        assetHash: 'a',
        presetId: 'site-thumb',
        cacheId: 'drv-site-thumb-480-webp-q80',
        cacheHit: false,
        ms: 0,
        error: 'Derivative decode failed',
      },
    ])
    expect(await cache.has('a', 'drv-site-thumb-480-webp-q80')).toBe(false)
  })

  it('reports an unreadable source without posting to the worker', async () => {
    const broken = request('a', ['site-thumb'])
    broken.readSource.mockRejectedValue(new Error('gone'))

    const results = await requestDerivatives([broken])

    expect(results[0]?.error).toBe('Derivative source unreadable')
    expect(worker.posted).toHaveLength(0)
  })

  it('fails in-flight jobs when the worker crashes and starts a fresh one', async () => {
    const pending = requestDerivatives([request('a', ['site-thumb'])])
    await vi.waitFor(() => {
      expect(worker.held).toHaveLength(1)
    })
    worker.held = []
    worker.emit?.('error')

    expect((await pending)[0]?.error).toBe('Derivative worker crashed')
    expect(worker.terminated).toBe(1)

    const next = requestDerivatives([request('b', ['site-thumb'])])
    await settleAndRelease()
    expect((await next)[0]?.cacheHit).toBe(false)
    expect(worker.instances).toBe(2)
  })

  it('keeps the queue moving when posting throws', async () => {
    vi.spyOn(MockWorker.prototype, 'postMessage').mockImplementationOnce(() => {
      throw new Error('DataCloneError')
    })

    const failed = await requestDerivatives([request('a', ['site-thumb'])])
    expect(failed[0]?.error).toBe('Derivative encode failed')

    const next = requestDerivatives([request('b', ['site-thumb'])])
    await settleAndRelease()
    expect((await next)[0]?.error).toBeUndefined()
  })

  it('flags a result whose cache write failed', async () => {
    vi.spyOn(cache, 'put').mockResolvedValue({ ok: false, code: 'corrupted' })

    const pending = requestDerivatives([request('a', ['site-thumb'])])
    await settleAndRelease()

    expect((await pending)[0]).toMatchObject({
      outputHash: 'hash-site-thumb',
      error: 'Derivative cache put failed: corrupted',
    })
  })
})

describe('getDerivative / forgetDerivatives', () => {
  it('reads encoded bytes back and forgets every preset of an asset', async () => {
    const pending = requestDerivatives([
      request('a', ['site-thumb', 'site-share']),
    ])
    await settleAndRelease()
    await pending

    const entry = await getDerivative('a', 'site-share')
    expect(entry?.mimeType).toBe('image/jpeg')
    expect(new TextDecoder().decode(entry?.bytes)).toBe('site-share')
    expect(await getDerivative('a', 'site-large')).toBeUndefined()
    expect(await getDerivative('a', 'site-huge')).toBeUndefined()

    await forgetDerivatives('a')

    expect(await getDerivative('a', 'site-thumb')).toBeUndefined()
    expect(await getDerivative('a', 'site-share')).toBeUndefined()
  })
})

describe('exposeDerivativesTestApi', () => {
  it('attaches the seam in dev / fixture builds', () => {
    const win = {} as Window
    exposeDerivativesTestApi(win)
    expect(win.__photobooksDerivatives?.requestDerivatives).toBe(
      requestDerivatives,
    )
    expect(win.__photobooksDerivatives?.presets).toBe(DERIVATIVE_PRESETS)
  })

  it('stays unset in a deploy build', () => {
    const bare = {} as Window
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '')
    try {
      exposeDerivativesTestApi(bare)
      expect(bare.__photobooksDerivatives).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('is a no-op without a window', () => {
    vi.stubGlobal('window', undefined)
    expect(() => {
      exposeDerivativesTestApi()
    }).not.toThrow()
  })
})

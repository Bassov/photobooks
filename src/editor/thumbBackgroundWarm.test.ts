import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetProcessResult } from '../photo/assetPool'
import {
  resetEditorGestureForTests,
  setEditorGestureActive,
} from './editorGesture'
import {
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'
import {
  resetFilmstripWindowForTests,
  setFilmstripWindow,
} from './filmstripWindow'
import {
  getBackgroundWarmStatsForTests,
  installThumbBackgroundWarm,
  orderWarmCandidates,
  resetThumbBackgroundWarmForTests,
  warmSlotCap,
} from './thumbBackgroundWarm'

const lane = vi.hoisted(() => ({
  gallery: [] as string[],
  keys: new Map<string, string>(),
  placed: new Set<string>(),
  importRunning: false,
  galleryListeners: new Set<() => void>(),
  tasks: [] as (() => void)[],
  stored: new Set<string>(),
  files: new Map<string, File>(),
  pending: new Set<string>(),
  deferred: new Map<string, Promise<AssetProcessResult>>(),
  onSourceFile: undefined as ((assetId: string) => void) | undefined,
  slotLimit: 8,
}))
const processAsset = vi.hoisted(() => vi.fn())
const setThumbUrl = vi.hoisted(() => vi.fn())
const restoreAspectFromDecode = vi.hoisted(() => vi.fn())

vi.mock('../photo/assetPool', () => ({
  processAsset: (...args: unknown[]): unknown => processAsset(...args),
  promoteDeferredLazyToWarm: (assetId: string) => {
    const deferred = lane.deferred.get(assetId)
    lane.deferred.delete(assetId)
    return deferred
  },
  hasDeferredLazyDecode: (assetId: string) => lane.deferred.has(assetId),
  hasPendingThumbDecode: (assetId: string) => lane.pending.has(assetId),
  getEffectiveDecodeSlotLimit: () => lane.slotLimit,
}))
vi.mock('../photo/decodeScheduler', () => ({
  scheduleWhenNowEmpty: (run: () => void) => {
    lane.tasks.push(run)
  },
}))
vi.mock('../assets/derivedCache/instance', () => ({
  getDerivedCache: () =>
    Promise.resolve({
      has: (cacheKey: string) => Promise.resolve(lane.stored.has(cacheKey)),
    }),
}))
vi.mock('./bookStore', () => ({
  getAssetCacheKey: (assetId: string) => lane.keys.get(assetId),
  getBookStoreSnapshot: () => ({ importRunning: lane.importRunning }),
  getGalleryIdsSnapshot: () => lane.gallery,
  getPlacedAssetIdsSnapshot: () => lane.placed,
  subscribeGallery: (listener: () => void) => {
    lane.galleryListeners.add(listener)
    return () => {
      lane.galleryListeners.delete(listener)
    }
  },
}))
vi.mock('./thumbMissDecode', () => ({
  sourceFileFor: (assetId: string) => {
    lane.onSourceFile?.(assetId)
    return Promise.resolve(lane.files.get(assetId))
  },
}))
vi.mock('./thumbCache', () => ({
  setThumbUrl: (...args: unknown[]): unknown => setThumbUrl(...args),
}))
vi.mock('./previewAspect', () => ({
  restoreAspectFromDecode: (...args: unknown[]): unknown =>
    restoreAspectFromDecode(...args),
}))

const ORDER = Array.from({ length: 10 }, (_, i) => `a${String(i)}`)

function decoded(assetId: string): AssetProcessResult {
  return {
    assetId,
    correctedWidth: 30,
    correctedHeight: 20,
    previewBuffer: new ArrayBuffer(4),
    previewMimeType: 'image/jpeg',
  } as AssetProcessResult
}

function addPhoto(assetId: string, file = true): void {
  lane.gallery.push(assetId)
  lane.keys.set(assetId, `key-${assetId}`)
  if (file) {
    lane.files.set(assetId, new File(['x'], `${assetId}.jpg`))
  }
}

function emitGallery(): void {
  for (const listener of lane.galleryListeners) {
    listener()
  }
}

/** Run scheduled passes until the lane is idle. */
async function drain(): Promise<void> {
  for (let round = 0; round < 20; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    const task = lane.tasks.shift()
    if (task === undefined) {
      return
    }
    task()
  }
}

function warmedIds(): unknown[] {
  return processAsset.mock.calls.map(
    ([options]) => (options as { assetId: string }).assetId,
  )
}

describe('orderWarmCandidates', () => {
  const ids = [...ORDER, 'appended']

  it('puts book-used first, then nearest to the window, ahead side first', () => {
    const window = { order: ORDER, start: 4, end: 6, direction: 1 } as const
    expect(orderWarmCandidates(ids, window, new Set(['a9']))).toEqual([
      'a9',
      'a4',
      'a5',
      'a6',
      'a3',
      'a7',
      'a2',
      'a8',
      'a1',
      'a0',
      'appended',
    ])
  })

  it('takes the side behind first after scrolling back', () => {
    const window = { order: ORDER, start: 4, end: 6, direction: -1 } as const
    expect(orderWarmCandidates(ids, window, new Set())).toEqual([
      'a4',
      'a5',
      'a3',
      'a6',
      'a2',
      'a7',
      'a1',
      'a8',
      'a0',
      'a9',
      'appended',
    ])
  })

  it('keeps input order for ids outside the window order', () => {
    const window = { order: [], start: 0, end: 0, direction: 0 } as const
    expect(orderWarmCandidates(['y', 'x', 'z'], window, new Set())).toEqual([
      'y',
      'x',
      'z',
    ])
  })
})

describe('thumb background warm lane', () => {
  let uninstall = (): void => undefined

  beforeEach(() => {
    lane.gallery = []
    lane.keys.clear()
    lane.placed = new Set()
    lane.importRunning = false
    lane.galleryListeners.clear()
    lane.tasks = []
    lane.stored.clear()
    lane.files.clear()
    lane.pending.clear()
    lane.deferred.clear()
    lane.onSourceFile = undefined
    lane.slotLimit = 8
    processAsset.mockReset()
    processAsset.mockImplementation((options: { assetId: string }) =>
      Promise.resolve(decoded(options.assetId)),
    )
    setThumbUrl.mockReset()
    restoreAspectFromDecode.mockReset()
  })

  afterEach(() => {
    uninstall()
    resetThumbBackgroundWarmForTests()
    resetFilmstripWindowForTests()
    resetFilmstripScrollQuietForTests()
    resetEditorGestureForTests()
  })

  it('caps in-flight jobs at the idle pool size, 1 while scrolling or gesturing', () => {
    expect(warmSlotCap()).toBe(4)
    lane.slotLimit = 2
    expect(warmSlotCap()).toBe(2)
    noteFilmstripScrollActivity()
    expect(warmSlotCap()).toBe(1)
    resetFilmstripScrollQuietForTests()
    setEditorGestureActive(true)
    expect(warmSlotCap()).toBe(1)
  })

  it('encodes each identity-complete asset without a stored thumb once', async () => {
    addPhoto('cached')
    lane.stored.add('key-cached')
    addPhoto('fresh')
    addPhoto('gone', false)
    lane.gallery.push('no-identity')
    uninstall = installThumbBackgroundWarm()
    await drain()

    expect(processAsset).toHaveBeenCalledTimes(1)
    expect(processAsset).toHaveBeenCalledWith({
      assetId: 'fresh',
      file: lane.files.get('fresh'),
      priority: 'background',
      backgroundWarm: true,
      noPoolRetry: true,
    })
    expect(restoreAspectFromDecode).toHaveBeenCalledWith('fresh', 30, 20)
    expect(setThumbUrl).toHaveBeenCalledWith(
      'fresh',
      expect.any(ArrayBuffer),
      'image/jpeg',
      'key-fresh',
    )
    expect(getBackgroundWarmStatsForTests()).toEqual({
      encoded: 1,
      inFlight: 0,
    })

    emitGallery()
    await drain()
    expect(processAsset).toHaveBeenCalledTimes(1)
  })

  it('never retries an unsupported file; retries an aborted one', async () => {
    addPhoto('phone.heic')
    addPhoto('aborted')
    let aborts = 0
    processAsset.mockImplementation((options: { assetId: string }) => {
      if (options.assetId === 'phone.heic') {
        return Promise.reject(new Error('unsupported'))
      }
      aborts += 1
      return aborts === 1
        ? Promise.reject(new DOMException('stop', 'AbortError'))
        : Promise.resolve(decoded(options.assetId))
    })
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(warmedIds().sort()).toEqual(['aborted', 'aborted', 'phone.heic'])
    expect(getBackgroundWarmStatsForTests().encoded).toBe(1)

    emitGallery()
    await drain()
    expect(processAsset).toHaveBeenCalledTimes(3)
  })

  it('promotes an import-deferred decode instead of starting its own', async () => {
    addPhoto('deferred')
    lane.pending.add('deferred')
    lane.deferred.set('deferred', Promise.resolve(decoded('deferred')))
    uninstall = installThumbBackgroundWarm()
    await drain()

    expect(processAsset).not.toHaveBeenCalled()
    // The import owner publishes the promoted result.
    expect(setThumbUrl).not.toHaveBeenCalled()
    expect(getBackgroundWarmStatsForTests().encoded).toBe(1)
  })

  it('leaves an asset to a now-lane decode that owns it', async () => {
    addPhoto('visible')
    addPhoto('raced')
    lane.pending.add('visible')
    lane.onSourceFile = (assetId) => {
      lane.pending.add(assetId)
    }
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(processAsset).not.toHaveBeenCalled()

    // The now-lane decode failed: the lane picks the asset up again.
    lane.pending.clear()
    lane.onSourceFile = undefined
    emitGallery()
    await drain()
    expect(warmedIds().sort()).toEqual(['raced', 'visible'])
  })

  it('waits for import, keeps 1 job in flight during a gesture, follows the window', async () => {
    for (const id of ORDER) {
      addPhoto(id)
    }
    const running = new Map<string, (result: AssetProcessResult) => void>()
    processAsset.mockImplementation(
      (options: { assetId: string }) =>
        new Promise<AssetProcessResult>((resolve) => {
          running.set(options.assetId, resolve)
        }),
    )
    lane.importRunning = true
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(processAsset).not.toHaveBeenCalled()

    lane.importRunning = false
    setEditorGestureActive(true)
    setFilmstripWindow({ order: ORDER, start: 6, end: 8, direction: 1 })
    await drain()
    expect(warmedIds()).toEqual(['a6'])

    emitGallery()
    await drain()
    expect(warmedIds()).toEqual(['a6'])
    expect(getBackgroundWarmStatsForTests().inFlight).toBe(1)

    running.get('a6')?.(decoded('a6'))
    await drain()
    expect(warmedIds()).toEqual(['a6', 'a7'])
  })

  it('stops scheduling passes once uninstalled', async () => {
    addPhoto('late')
    uninstall = installThumbBackgroundWarm()
    uninstall()
    await drain()
    emitGallery()
    setFilmstripWindow({ order: ['late'], start: 0, end: 1, direction: 0 })
    await drain()
    expect(processAsset).not.toHaveBeenCalled()
  })
})

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
  type FilmstripWindow,
} from './filmstripWindow'
import {
  getBackgroundWarmStatsForTests,
  installThumbBackgroundWarm,
  orderWarmCandidates,
  resetThumbBackgroundWarmForTests,
  WARM_SLICE_BUDGET_MS,
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
  keyReads: 0,
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
  getAssetCacheKey: (assetId: string) => {
    lane.keyReads += 1
    return lane.keys.get(assetId)
  },
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

  it('takes the side ahead first when the direction is unknown', () => {
    const window = { order: ORDER, start: 4, end: 6, direction: 0 } as const
    expect(orderWarmCandidates(['a3', 'a6'], window, new Set())).toEqual([
      'a6',
      'a3',
    ])
  })

  it('orders the mounted window by position', () => {
    const window = { order: ORDER, start: 0, end: 10, direction: 1 } as const
    expect(
      orderWarmCandidates([...ORDER].reverse(), window, new Set()),
    ).toEqual(ORDER)
  })

  it('keeps input order for ids outside the window order, after known ids', () => {
    const window = { order: ORDER, start: 0, end: 2, direction: 1 } as const
    expect(
      orderWarmCandidates(['y', 'x', 'a1', 'z'], window, new Set()),
    ).toEqual(['a1', 'y', 'x', 'z'])
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
    lane.keyReads = 0
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
    expect(getBackgroundWarmStatsForTests()).toMatchObject({
      encoded: 1,
      inFlight: 0,
      settledCount: 3,
    })

    emitGallery()
    await drain()
    expect(processAsset).toHaveBeenCalledTimes(1)
  })

  it('never retries an unsupported file; retries an aborted one', async () => {
    addPhoto('phone.heic')
    addPhoto('corrupt')
    addPhoto('aborted')
    let aborts = 0
    processAsset.mockImplementation((options: { assetId: string }) => {
      if (options.assetId === 'phone.heic') {
        return Promise.reject(new Error('unsupported'))
      }
      if (options.assetId === 'corrupt') {
        return Promise.reject(new DOMException('bad', 'EncodingError'))
      }
      aborts += 1
      return aborts === 1
        ? Promise.reject(new DOMException('stop', 'AbortError'))
        : Promise.resolve(decoded(options.assetId))
    })
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(warmedIds().sort()).toEqual([
      'aborted',
      'aborted',
      'corrupt',
      'phone.heic',
    ])
    expect(getBackgroundWarmStatsForTests().encoded).toBe(1)

    emitGallery()
    await drain()
    expect(processAsset).toHaveBeenCalledTimes(4)
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
    // Idle: no pass keeps re-trying an asset the now lane owns.
    expect(lane.tasks).toEqual([])

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

  it('coalesces pass requests until the pass runs', async () => {
    addPhoto('one')
    uninstall = installThumbBackgroundWarm()
    emitGallery()
    setFilmstripWindow({ order: ['one'], start: 0, end: 1, direction: 0 })
    expect(lane.tasks).toHaveLength(1)
    await drain()
    expect(warmedIds()).toEqual(['one'])
  })

  it('refills only free slots and starts none once the cap drops below in-flight', async () => {
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
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(warmedIds()).toEqual(['a0', 'a1', 'a2', 'a3'])

    running.get('a0')?.(decoded('a0'))
    await drain()
    expect(warmedIds()).toEqual(['a0', 'a1', 'a2', 'a3', 'a4'])

    setEditorGestureActive(true)
    emitGallery()
    await drain()
    expect(processAsset).toHaveBeenCalledTimes(5)
  })

  it('reset forgets progress, in-flight jobs and settled assets', async () => {
    addPhoto('done')
    addPhoto('hang')
    processAsset.mockImplementation((options: { assetId: string }) =>
      options.assetId === 'hang'
        ? new Promise<AssetProcessResult>(() => undefined)
        : Promise.resolve(decoded(options.assetId)),
    )
    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(getBackgroundWarmStatsForTests()).toMatchObject({
      encoded: 1,
      inFlight: 1,
      settledCount: 1,
    })
    uninstall()
    resetThumbBackgroundWarmForTests()
    expect(getBackgroundWarmStatsForTests()).toEqual({
      encoded: 0,
      inFlight: 0,
      settledCount: 0,
      longestSliceMs: 0,
    })

    uninstall = installThumbBackgroundWarm()
    await drain()
    expect(warmedIds().sort()).toEqual(['done', 'done', 'hang', 'hang'])
  })

  it('stops scheduling passes once uninstalled', async () => {
    addPhoto('late')
    uninstall = installThumbBackgroundWarm()
    uninstall()
    expect(lane.galleryListeners.size).toBe(0)
    await drain()
    emitGallery()
    setFilmstripWindow({ order: ['late'], start: 0, end: 1, direction: 0 })
    await drain()
    expect(processAsset).not.toHaveBeenCalled()
  })

  describe('sliced passes', () => {
    beforeEach(() => {
      // Each clock read advances 1 ms: a slice fits budget-many steps.
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1))
      // Jobs never settle: only the first pass starts anything.
      processAsset.mockImplementation(
        () => new Promise<AssetProcessResult>(() => undefined),
      )
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Run queued slices synchronously (no job settles); key reads per slice. */
    function runSlices(): number[] {
      const reads: number[] = []
      for (let task = lane.tasks.shift(); task; task = lane.tasks.shift()) {
        const before = lane.keyReads
        task()
        reads.push(lane.keyReads - before)
      }
      return reads
    }

    it('runs a pass over many assets as slices that stop once the budget is spent', async () => {
      const ids = Array.from({ length: 40 }, (_, i) => `p${String(i)}`)
      for (const id of ids) {
        addPhoto(id)
      }
      uninstall = installThumbBackgroundWarm()
      const reads = runSlices()

      // 40 scans + 4 starts, at most budget-many steps per slice.
      expect(reads.length).toBeGreaterThanOrEqual(44 / WARM_SLICE_BUDGET_MS)
      expect(Math.max(...reads)).toBe(WARM_SLICE_BUDGET_MS)
      expect(reads.reduce((sum, n) => sum + n, 0)).toBe(44)
      // A start step also reads the clock once (scroll-quiet slot cap).
      const { longestSliceMs } = getBackgroundWarmStatsForTests()
      expect(longestSliceMs).toBeGreaterThanOrEqual(WARM_SLICE_BUDGET_MS)
      expect(longestSliceMs).toBeLessThanOrEqual(WARM_SLICE_BUDGET_MS + 1)
      await drain()
      expect(warmedIds()).toEqual(ids.slice(0, 4))
    })

    it.each<{
      name: string
      gallery: readonly string[]
      placed: string[]
      window: FilmstripWindow
    }>([
      {
        name: 'book-used, then nearest, behind side first',
        gallery: ORDER,
        placed: ['a8'],
        window: { order: ORDER, start: 4, end: 6, direction: -1 },
      },
      {
        name: 'ids missing from the window order last, in gallery order',
        gallery: ['y', 'a1', 'x', 'z', 'w'],
        placed: [],
        window: { order: ORDER, start: 0, end: 2, direction: 1 },
      },
    ])('picks what orderWarmCandidates puts first: $name', async (row) => {
      for (const id of row.gallery) {
        addPhoto(id)
      }
      lane.placed = new Set(row.placed)
      setFilmstripWindow(row.window)
      uninstall = installThumbBackgroundWarm()
      runSlices()
      await drain()

      const expected = orderWarmCandidates(
        row.gallery,
        row.window,
        lane.placed,
      ).slice(0, 4)
      expect(warmedIds()).toEqual(expected)
    })

    it('requests during an open pass coalesce into one rerun after it', () => {
      addPhoto('one')
      addPhoto('two')
      uninstall = installThumbBackgroundWarm()
      // Slice 1 spends its budget scanning; the pass stays open.
      lane.tasks.shift()?.()
      expect(getBackgroundWarmStatsForTests().inFlight).toBe(0)
      expect(lane.tasks).toHaveLength(1)
      emitGallery()
      setFilmstripWindow({ order: ['two'], start: 0, end: 1, direction: 1 })
      expect(lane.tasks).toHaveLength(1)

      const before = lane.keyReads
      runSlices()
      // Two starts (1 read each), then a single rerun scanning both ids.
      expect(lane.keyReads - before).toBe(4)
      expect(getBackgroundWarmStatsForTests().inFlight).toBe(2)
    })

    it('assets a now-lane decode owns take no pick slot', async () => {
      for (const id of ['p0', 'p1', 'p2', 'p3', 'free']) {
        addPhoto(id)
      }
      for (const id of ['p0', 'p1', 'p2', 'p3']) {
        lane.pending.add(id)
      }
      uninstall = installThumbBackgroundWarm()
      runSlices()
      await drain()
      expect(warmedIds()).toEqual(['free'])
    })

    it('starts only up to the slot cap read at start time', () => {
      for (const id of ORDER) {
        addPhoto(id)
      }
      uninstall = installThumbBackgroundWarm()
      lane.tasks.shift()?.()
      setEditorGestureActive(true)
      runSlices()
      expect(getBackgroundWarmStatsForTests().inFlight).toBe(1)
    })

    it('does not rescan the gallery while every slot is busy', () => {
      for (const id of ORDER) {
        addPhoto(id)
      }
      uninstall = installThumbBackgroundWarm()
      runSlices()
      expect(getBackgroundWarmStatsForTests().inFlight).toBe(4)
      const before = lane.keyReads
      emitGallery()
      runSlices()
      expect(lane.keyReads).toBe(before)
    })

    it('a job settling after uninstall schedules no pass', async () => {
      let finish: (result: AssetProcessResult) => void = () => undefined
      processAsset.mockImplementation(
        () =>
          new Promise<AssetProcessResult>((resolve) => {
            finish = resolve
          }),
      )
      addPhoto('late')
      uninstall = installThumbBackgroundWarm()
      runSlices()
      await drain()
      expect(warmedIds()).toEqual(['late'])
      uninstall()
      finish(decoded('late'))
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(getBackgroundWarmStatsForTests().inFlight).toBe(0)
      expect(lane.tasks).toHaveLength(0)
    })

    it('import start drops the open pass; the next pass starts over', async () => {
      for (const id of ORDER) {
        addPhoto(id)
      }
      uninstall = installThumbBackgroundWarm()
      lane.tasks.shift()?.()
      lane.importRunning = true
      lane.tasks.shift()?.()
      expect(lane.tasks).toHaveLength(0)

      lane.importRunning = false
      lane.placed = new Set(['a9'])
      emitGallery()
      runSlices()
      await drain()
      expect(warmedIds()).toEqual(['a9', 'a0', 'a1', 'a2'])
    })
  })
})

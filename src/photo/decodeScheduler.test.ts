import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeLaneFor } from './decodeQueuePolicy'
import {
  applyDecodePressureSignals,
  assetsLeavingNow,
  buildNowAssetIds,
  canStartAnotherSlot,
  combineDecodeAbortSignals,
  countBusySlots,
  decodeJobRank,
  dualTiersDefaultForImport,
  ensureActiveAbortController,
  keepsInFlightOnLeaveNow,
  pendingRetryFromJob,
  priorityRank,
  queueHasBackgroundLane,
  relabelQueueLanes,
  scheduleWhenNowEmpty,
  shouldScheduleBackgroundDrain,
  sortDecodeJobs,
  takeNextDecodeJob,
} from './decodeScheduler'
import { PREVIEW_MAX_EDGE, THUMB_MAX_EDGE } from './photoEdges'

describe('decodeScheduler', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('buildNowAssetIds unions visible and book-used', () => {
    expect(
      [...buildNowAssetIds(new Set(['a']), new Set(['b', 'a']))].sort(),
    ).toEqual(['a', 'b'])
    expect(buildNowAssetIds(new Set(), new Set()).size).toBe(0)
  })

  it('assetsLeavingNow skips ids that remain or are book-used', () => {
    expect(
      assetsLeavingNow(
        new Set(['a', 'b', 'c']),
        new Set(['a']),
        new Set(['b']),
      ),
    ).toEqual(['c'])
    expect(
      assetsLeavingNow(new Set(['a']), new Set(['a', 'b']), new Set()),
    ).toEqual([])
  })

  it('priorityRank orders visible > zoom > prefetch > background', () => {
    expect(priorityRank('visible')).toBe(4)
    expect(priorityRank('zoom')).toBe(3)
    expect(priorityRank('prefetch')).toBe(2)
    expect(priorityRank('background')).toBe(1)
  })

  it('decodeJobRank boosts now-set membership over priority alone', () => {
    const now = new Set(['vis'])
    expect(decodeJobRank('prefetch', 'vis', now)).toBe(
      decodeJobRank('prefetch', 'other', now) + 10,
    )
    expect(decodeJobRank('visible', 'other', now)).toBeGreaterThan(
      decodeJobRank('background', 'other', now),
    )
    expect(decodeJobRank('visible', 'x', new Set())).toBe(4)
    expect(decodeJobRank('zoom', 'x', new Set())).toBe(3)
    expect(decodeJobRank('prefetch', 'x', new Set())).toBe(2)
    expect(decodeJobRank('background', 'x', new Set())).toBe(1)
  })

  it('sortDecodeJobs puts now ahead of background then higher rank', () => {
    const now = new Set(['n'])
    const queue = [
      {
        lane: 'background' as const,
        priority: 'prefetch' as const,
        assetId: 'bg',
      },
      {
        lane: 'now' as const,
        priority: 'prefetch' as const,
        assetId: 'n',
      },
      {
        lane: 'now' as const,
        priority: 'visible' as const,
        assetId: 'n',
      },
    ]
    sortDecodeJobs(queue, now)
    expect(queue.map((j) => `${j.lane}:${j.priority}`)).toEqual([
      'now:visible',
      'now:prefetch',
      'background:prefetch',
    ])
  })

  it('takeNextDecodeJob sorts before picking so later now beats earlier background', () => {
    const now = new Set(['n'])
    const queue = [
      {
        lane: 'background' as const,
        priority: 'prefetch' as const,
        assetId: 'bg-first',
      },
      {
        lane: 'now' as const,
        priority: 'visible' as const,
        assetId: 'n',
      },
    ]
    const picked = takeNextDecodeJob(queue, true, now, () => {
      // no-op
    })
    expect(picked?.assetId).toBe('n')
    expect(queue.map((j) => j.assetId)).toEqual(['bg-first'])
  })

  it('countBusySlots and canStartAnotherSlot enforce the effective limit', () => {
    expect(
      countBusySlots([{ busy: true }, { busy: false }, { busy: true }]),
    ).toBe(2)
    expect(canStartAnotherSlot(1, 2)).toBe(true)
    expect(canStartAnotherSlot(2, 2)).toBe(false)
    expect(canStartAnotherSlot(3, 2)).toBe(false)
  })

  it('shouldScheduleBackgroundDrain only after a now-only pump', () => {
    expect(shouldScheduleBackgroundDrain(false, true)).toBe(true)
    expect(shouldScheduleBackgroundDrain(false, false)).toBe(false)
    expect(shouldScheduleBackgroundDrain(true, true)).toBe(false)
    expect(shouldScheduleBackgroundDrain(true, false)).toBe(false)
  })

  it('dualTiersDefaultForImport is always false (bulk encodes thumb320 only)', () => {
    expect(dualTiersDefaultForImport()).toBe(false)
  })

  it('applyDecodePressureSignals updates only provided flags', () => {
    expect(
      applyDecodePressureSignals(
        { longTaskPressure: false, memoryPressure: false },
        { longTaskPressure: true },
      ),
    ).toEqual({ longTaskPressure: true, memoryPressure: false })
    expect(
      applyDecodePressureSignals(
        { longTaskPressure: true, memoryPressure: true },
        { memoryPressure: false },
      ),
    ).toEqual({ longTaskPressure: true, memoryPressure: false })
    expect(
      applyDecodePressureSignals(
        { longTaskPressure: true, memoryPressure: true },
        {},
      ),
    ).toEqual({ longTaskPressure: true, memoryPressure: true })
  })

  it('takeNextDecodeJob skips aborted items and respects allowBackground', () => {
    const aborted = new AbortController()
    aborted.abort()
    const now = new Set<string>()
    const rejected: string[] = []
    const queue = [
      {
        lane: 'now' as const,
        priority: 'visible' as const,
        assetId: 'dead',
        signal: aborted.signal,
      },
      {
        lane: 'now' as const,
        priority: 'zoom' as const,
        assetId: 'live',
      },
      {
        lane: 'background' as const,
        priority: 'prefetch' as const,
        assetId: 'bg',
      },
    ]
    const first = takeNextDecodeJob(queue, false, now, (job) => {
      rejected.push(job.assetId)
    })
    expect(rejected).toEqual(['dead'])
    expect(first?.assetId).toBe('live')
    expect(queue.map((j) => j.assetId)).toEqual(['bg'])

    expect(
      takeNextDecodeJob(queue, false, now, (job) => {
        rejected.push(job.assetId)
      }),
    ).toBeUndefined()
    expect(queue.map((j) => j.assetId)).toEqual(['bg'])

    expect(
      takeNextDecodeJob(queue, true, now, (job) => {
        rejected.push(job.assetId)
      })?.assetId,
    ).toBe('bg')
    expect(queue).toHaveLength(0)
  })

  it('takeNextDecodeJob returns undefined for an empty queue', () => {
    const onAborted = (): void => {
      // no-op
    }
    const next = takeNextDecodeJob(
      [] as {
        lane: 'now' | 'background'
        priority: 'prefetch'
        assetId: string
      }[],
      true,
      new Set(),
      onAborted,
    )
    expect(next).toBeUndefined()
  })

  it('keepsInFlightOnLeaveNow keeps thumb320 only, not 1280 or other edges', () => {
    expect(keepsInFlightOnLeaveNow({ maxEdge: THUMB_MAX_EDGE })).toBe(true)
    expect(keepsInFlightOnLeaveNow({ maxEdge: PREVIEW_MAX_EDGE })).toBe(false)
    expect(keepsInFlightOnLeaveNow({ maxEdge: 64 })).toBe(false)
  })

  it('pendingRetryFromJob always re-enters as visible', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    expect(
      pendingRetryFromJob({
        assetId: 'a',
        file,
        maxEdge: 320,
        cover: true,
        dualTiers: true,
      }),
    ).toEqual({
      assetId: 'a',
      file,
      priority: 'visible',
      maxEdge: 320,
      cover: true,
      dualTiers: true,
    })
  })

  it('relabelQueueLanes updates lanes from the now set', () => {
    const queue = [
      {
        priority: 'prefetch' as const,
        assetId: 'a',
        lane: 'background' as const,
      },
    ]
    relabelQueueLanes(queue, new Set(['a']))
    expect(queue[0]?.lane).toBe('now')
    expect(decodeLaneFor('prefetch', 'a', new Set(['a']))).toBe('now')
  })

  it('queueHasBackgroundLane detects background-only remainder', () => {
    expect(queueHasBackgroundLane([{ lane: 'now' }])).toBe(false)
    expect(
      queueHasBackgroundLane([{ lane: 'now' }, { lane: 'background' }]),
    ).toBe(true)
    expect(queueHasBackgroundLane([])).toBe(false)
  })

  it('scheduleWhenNowEmpty prefers background postTask when available', async () => {
    const order: string[] = []
    const postTask = vi.fn((cb: () => void) => {
      queueMicrotask(cb)
      return Promise.resolve()
    })
    vi.stubGlobal('scheduler', { postTask })
    scheduleWhenNowEmpty(() => {
      order.push('idle')
    })
    order.push('sync')
    expect(postTask).toHaveBeenCalledWith(expect.any(Function), {
      priority: 'background',
    })
    await Promise.resolve()
    expect(order).toEqual(['sync', 'idle'])
    vi.unstubAllGlobals()
  })

  it('scheduleWhenNowEmpty falls back to setTimeout(0) without idle APIs', async () => {
    vi.stubGlobal('scheduler', undefined)
    vi.stubGlobal('requestIdleCallback', undefined)
    const order: string[] = []
    scheduleWhenNowEmpty(() => {
      order.push('idle')
    })
    order.push('sync')
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(order).toEqual(['sync', 'idle'])
    vi.unstubAllGlobals()
  })

  it('scheduleWhenNowEmpty uses requestIdleCallback when postTask is absent', async () => {
    vi.stubGlobal('scheduler', undefined)
    const ric = vi.fn((cb: () => void) => {
      queueMicrotask(cb)
      return 1
    })
    vi.stubGlobal('requestIdleCallback', ric)
    const order: string[] = []
    scheduleWhenNowEmpty(() => {
      order.push('idle')
    })
    order.push('sync')
    expect(ric).toHaveBeenCalled()
    await Promise.resolve()
    expect(order).toEqual(['sync', 'idle'])
  })

  it('ensureActiveAbortController replaces aborted controllers', () => {
    expect(ensureActiveAbortController(undefined).signal.aborted).toBe(false)
    const live = new AbortController()
    expect(ensureActiveAbortController(live)).toBe(live)
    const dead = new AbortController()
    dead.abort()
    const next = ensureActiveAbortController(dead)
    expect(next).not.toBe(dead)
    expect(next.signal.aborted).toBe(false)
  })

  it('combineDecodeAbortSignals merges outer and pool signals', () => {
    const pool = new AbortController()
    expect(combineDecodeAbortSignals(pool.signal, undefined)).toBe(pool.signal)

    const outer = new AbortController()
    const combined = combineDecodeAbortSignals(pool.signal, outer.signal)
    expect(combined.aborted).toBe(false)
    outer.abort()
    expect(combined.aborted).toBe(true)
  })

  it('combineDecodeAbortSignals falls back when AbortSignal.any is missing', () => {
    const pool = new AbortController()
    const outer = new AbortController()
    const original = AbortSignal.any.bind(AbortSignal)
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined,
    })
    try {
      expect(combineDecodeAbortSignals(pool.signal, outer.signal)).toBe(
        pool.signal,
      )
      outer.abort()
      expect(combineDecodeAbortSignals(pool.signal, outer.signal)).toBe(
        outer.signal,
      )
    } finally {
      Object.defineProperty(AbortSignal, 'any', {
        configurable: true,
        value: original,
      })
    }
  })
})

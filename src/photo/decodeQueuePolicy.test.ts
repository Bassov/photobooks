import { describe, expect, it } from 'vitest'
import {
  backoffConcurrency,
  compareDecodeJobs,
  DECODE_POOL_CAP,
  DECODE_POOL_CAP_IDLE,
  DECODE_POOL_CAP_IMPORT,
  decodeLaneFor,
  decodeWorkerCount,
  isNowPriority,
  resolveDecodeCores,
} from './decodeQueuePolicy'

describe('decodeQueuePolicy', () => {
  it('resolves invalid hardwareConcurrency to the 2-core fallback', () => {
    expect(resolveDecodeCores(undefined)).toBe(2)
    expect(resolveDecodeCores(0)).toBe(2)
    expect(resolveDecodeCores(-1)).toBe(2)
    expect(resolveDecodeCores(1)).toBe(1)
    expect(resolveDecodeCores(8)).toBe(8)
  })

  it('sizes idle pool as min(4, max(1, hw-1)) and import higher', () => {
    expect(DECODE_POOL_CAP_IDLE).toBe(4)
    expect(DECODE_POOL_CAP_IMPORT).toBe(8)
    expect(DECODE_POOL_CAP).toBe(DECODE_POOL_CAP_IMPORT)
    expect(decodeWorkerCount(undefined)).toBe(1)
    expect(decodeWorkerCount(0)).toBe(1)
    expect(decodeWorkerCount(1)).toBe(1)
    expect(decodeWorkerCount(2)).toBe(1)
    expect(decodeWorkerCount(3)).toBe(2)
    expect(decodeWorkerCount(5)).toBe(DECODE_POOL_CAP_IDLE)
    expect(decodeWorkerCount(32)).toBe(DECODE_POOL_CAP_IDLE)
    expect(decodeWorkerCount(5, { importActive: true })).toBe(4)
    expect(decodeWorkerCount(9, { importActive: true })).toBe(
      DECODE_POOL_CAP_IMPORT,
    )
    expect(decodeWorkerCount(32, { importActive: true })).toBe(
      DECODE_POOL_CAP_IMPORT,
    )
  })

  it('treats only visible and zoom as now priorities', () => {
    expect(isNowPriority('visible')).toBe(true)
    expect(isNowPriority('zoom')).toBe(true)
    expect(isNowPriority('prefetch')).toBe(false)
    expect(isNowPriority('background')).toBe(false)
  })

  it('maps visible/zoom via now priorities even with an empty now set', () => {
    const empty = new Set<string>()
    expect(decodeLaneFor('visible', 'alone', empty)).toBe('now')
    expect(decodeLaneFor('zoom', 'alone', empty)).toBe('now')
    expect(decodeLaneFor('prefetch', 'alone', empty)).toBe('background')
    expect(decodeLaneFor('background', 'alone', empty)).toBe('background')
  })

  it('maps now-set membership to the now lane for prefetch/background', () => {
    const now = new Set(['a'])
    expect(decodeLaneFor('prefetch', 'a', now)).toBe('now')
    expect(decodeLaneFor('background', 'a', now)).toBe('now')
    expect(decodeLaneFor('prefetch', 'b', now)).toBe('background')
    expect(decodeLaneFor('background', 'b', now)).toBe('background')
  })

  it('orders now ahead of background, then by exact rank delta', () => {
    expect(
      compareDecodeJobs(
        { lane: 'now', rank: 1 },
        { lane: 'background', rank: 99 },
      ),
    ).toBe(-1)
    expect(
      compareDecodeJobs(
        { lane: 'background', rank: 99 },
        { lane: 'now', rank: 1 },
      ),
    ).toBe(1)
    expect(
      compareDecodeJobs({ lane: 'now', rank: 2 }, { lane: 'now', rank: 5 }),
    ).toBe(3)
    expect(
      compareDecodeJobs({ lane: 'now', rank: 5 }, { lane: 'now', rank: 2 }),
    ).toBe(-3)
    expect(
      compareDecodeJobs(
        { lane: 'background', rank: 4 },
        { lane: 'background', rank: 4 },
      ),
    ).toBe(0)
  })

  it('backs off concurrency on longtask and memory pressure', () => {
    expect(backoffConcurrency(4, {})).toBe(4)
    expect(backoffConcurrency(4, { longTaskPressure: true })).toBe(2)
    expect(backoffConcurrency(4, { memoryPressure: true })).toBe(1)
    expect(
      backoffConcurrency(4, {
        longTaskPressure: true,
        memoryPressure: true,
      }),
    ).toBe(1)
    expect(backoffConcurrency(1, { longTaskPressure: true })).toBe(1)
    expect(backoffConcurrency(0, {})).toBe(1)
    expect(backoffConcurrency(9, {})).toBe(DECODE_POOL_CAP)
  })
})

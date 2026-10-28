import { describe, expect, it } from 'vitest'
import { PERF_BUDGETS } from './budgets'

describe('PERF_BUDGETS', () => {
  it('matches architecture defaults', () => {
    expect(PERF_BUDGETS).toEqual({
      cpuThrottleRate: 2,
      loafEntriesMax: 0,
      loafNoiseBlockingMs: 20,
      loafNoiseEntriesMax: 1,
      handlerP95Ms: 2,
      inpMs: 100,
      frameP95Ms: 16.7,
      droppedFrameRatio: 0.02,
      scanSchedulerLongTaskMs: 100,
    })
  })
})

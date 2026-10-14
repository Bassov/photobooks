import { afterEach, describe, expect, it } from 'vitest'
import {
  assertHandlerP95WithinBudget,
  clearHandlerMeasures,
  getHandlerMeasureDurations,
  measureHandler,
  measureHandlerSync,
} from './measureHandler'

describe('measureHandler', () => {
  afterEach(() => {
    clearHandlerMeasures()
  })

  it('records a measure for the label', async () => {
    const result = await measureHandler('open-photo', () => 42)
    expect(result).toBe(42)
    const durations = getHandlerMeasureDurations('open-photo')
    expect(durations.length).toBe(1)
    expect(durations[0]).toBeGreaterThanOrEqual(0)
    assertHandlerP95WithinBudget('open-photo', 1000)
  })

  it('records a sync kickoff measure without awaiting work', () => {
    const pending = measureHandlerSync('open-photo', () =>
      Promise.resolve('ok'),
    )
    expect(pending).toBeInstanceOf(Promise)
    const durations = getHandlerMeasureDurations('open-photo')
    expect(durations.length).toBe(1)
    assertHandlerP95WithinBudget('open-photo', 50)
  })

  it('throws when asserting without measures', () => {
    expect(() => {
      assertHandlerP95WithinBudget('missing')
    }).toThrow(/No performance.measure/)
  })
})

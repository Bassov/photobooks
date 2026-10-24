import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from './assetPool'
import {
  startDecodePressureObserver,
  stopDecodePressureObserver,
} from './decodePressure'

describe('decodePressure', () => {
  afterEach(() => {
    stopDecodePressureObserver()
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('observes longtask entries and starts memory polling', () => {
    let observedType: string | undefined
    class MockPerformanceObserver {
      observe(init: { type: string }): void {
        observedType = init.type
      }

      disconnect(): void {
        observedType = undefined
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    vi.stubGlobal('performance', {
      memory: { usedJSHeapSize: 1, jsHeapSizeLimit: 100 },
    })

    startDecodePressureObserver()
    expect(
      observedType === 'longtask' || observedType === 'long-animation-frame',
    ).toBe(true)
    startDecodePressureObserver()
    stopDecodePressureObserver()
    expect(observedType).toBeUndefined()
  })
})

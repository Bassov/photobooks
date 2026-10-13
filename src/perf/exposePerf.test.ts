import { afterEach, describe, expect, it, vi } from 'vitest'

describe('exposePerf', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__photobooksPerf')
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('enables hooks in DEV and exposes window API', async () => {
    vi.stubEnv('DEV', true)
    class MockPerformanceObserver {
      observe(): void {
        // no-op
      }

      disconnect(): void {
        // no-op
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

    const { enablePerfHooks, shouldEnablePerfHooks } =
      await import('./exposePerf')

    expect(shouldEnablePerfHooks()).toBe(true)
    enablePerfHooks()
    expect(window.__photobooksPerf).toBeDefined()
    expect(window.__photobooksPerf?.loafBlockingBudgetMs).toBe(200)
  })

  it('enables when loaf query param is set outside DEV', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('location', new URL('http://localhost/?loaf=1'))

    class MockPerformanceObserver {
      observe(): void {
        // no-op
      }

      disconnect(): void {
        // no-op
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

    const { shouldEnablePerfHooks, enablePerfHooks } =
      await import('./exposePerf')

    expect(shouldEnablePerfHooks()).toBe(true)
    enablePerfHooks()
    expect(window.__photobooksPerf?.isLoafObserving()).toBe(true)
  })

  it('does not enable outside DEV without loaf param', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('location', new URL('http://localhost/'))

    const { shouldEnablePerfHooks } = await import('./exposePerf')
    expect(shouldEnablePerfHooks()).toBe(false)
  })
})

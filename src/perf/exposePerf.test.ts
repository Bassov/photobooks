import { afterEach, describe, expect, it, vi } from 'vitest'

describe('exposePerf', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__photobooksPerf')
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  function stubObservers(): void {
    class MockPerformanceObserver {
      observe(): void {
        // no-op
      }

      disconnect(): void {
        // no-op
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {
      // no-op
    })
  }

  it('enables hooks in DEV and exposes window API', async () => {
    vi.stubEnv('DEV', true)
    stubObservers()

    const { enablePerfHooks, shouldEnablePerfHooks } =
      await import('./exposePerf')

    expect(shouldEnablePerfHooks()).toBe(true)
    enablePerfHooks()
    expect(window.__photobooksPerf).toBeDefined()
    expect(window.__photobooksPerf?.budgets.loafEntriesMax).toBe(0)
    expect(window.__photobooksPerf?.budgets.handlerP95Ms).toBe(2)
  })

  it('enables when perf query param is set outside DEV', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('location', new URL('http://localhost/?perf=1'))
    stubObservers()

    const { shouldEnablePerfHooks, enablePerfHooks } =
      await import('./exposePerf')

    expect(shouldEnablePerfHooks()).toBe(true)
    enablePerfHooks()
    expect(window.__photobooksPerf?.isLoafObserving()).toBe(true)
  })

  it('enables when legacy loaf query param is set', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('location', new URL('http://localhost/?loaf=1'))
    stubObservers()

    const { shouldEnablePerfHooks } = await import('./exposePerf')
    expect(shouldEnablePerfHooks()).toBe(true)
  })

  it('does not enable outside DEV without perf flags', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('location', new URL('http://localhost/'))

    const { shouldEnablePerfHooks } = await import('./exposePerf')
    expect(shouldEnablePerfHooks()).toBe(false)
  })
})

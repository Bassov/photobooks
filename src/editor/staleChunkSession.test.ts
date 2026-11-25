import { afterEach, describe, expect, it, vi } from 'vitest'
import { STALE_CHUNK_RELOAD_KEY } from '../lib/staleChunkReload'

const flushBeforeReload = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('./projectSession', () => ({ flushBeforeReload }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  flushBeforeReload.mockClear()
  window.sessionStorage.clear()
})

async function load() {
  return import('./staleChunkSession')
}

describe('staleChunkSession', () => {
  it('returns one shared recovery', async () => {
    const { staleChunkRecovery } = await load()
    expect(staleChunkRecovery()).toBe(staleChunkRecovery())
  })

  it('a vite:preloadError saves, marks sessionStorage and reloads once', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const { installStaleChunkReload } = await load()
    const uninstall = installStaleChunkReload()
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1)
    })
    // The import still rejects, so its caller can show the error.
    expect(event.defaultPrevented).toBe(false)
    expect(flushBeforeReload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)).toMatch(
      /^\d+$/,
    )
    uninstall()
  })

  it('stops listening after uninstall', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const { installStaleChunkReload, staleChunkRecovery } = await load()
    installStaleChunkReload()()
    window.dispatchEvent(new Event('vite:preloadError'))
    expect(flushBeforeReload).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(staleChunkRecovery()).toBeDefined()
  })
})

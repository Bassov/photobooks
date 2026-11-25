import { describe, expect, it, vi } from 'vitest'
import {
  createStaleChunkRecovery,
  isChunkLoadError,
  STALE_CHUNK_RELOAD_KEY,
  STALE_CHUNK_RELOAD_WINDOW_MS,
  type StaleChunkDeps,
} from './staleChunkReload'

const T0 = 1_000_000

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

function setup(
  overrides: Partial<StaleChunkDeps> & {
    stored?: Record<string, string>
  } = {},
) {
  const storage = memoryStorage(overrides.stored)
  const reload = vi.fn()
  const flush = vi.fn(() => Promise.resolve(true))
  const recovery = createStaleChunkRecovery({
    storage,
    now: () => T0,
    flush,
    reload,
    ...overrides,
  })
  return { storage, reload, flush, recovery }
}

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/SitePreview-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/SitePreview-abc.css',
  ])('matches %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('rejects other errors and non-errors', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
    expect(
      isChunkLoadError('Failed to fetch dynamically imported module'),
    ).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('createStaleChunkRecovery', () => {
  it('saves, marks the reload time, then reloads once', async () => {
    const order: string[] = []
    const { storage, recovery } = setup({
      flush: () => {
        order.push('flush')
        return Promise.resolve(true)
      },
      reload: () => {
        order.push('reload')
      },
    })
    expect(await recovery.recover()).toBe('reloading')
    expect(order).toEqual(['flush', 'reload'])
    expect(storage.map.get(STALE_CHUNK_RELOAD_KEY)).toBe(String(T0))
  })

  it('shares one attempt between concurrent failures', async () => {
    const { reload, flush, recovery } = setup()
    const [a, b] = await Promise.all([recovery.recover(), recovery.recover()])
    expect([a, b]).toEqual(['reloading', 'reloading'])
    expect(flush).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again right after a reload (no loop)', async () => {
    const { reload, flush, recovery } = setup({
      stored: {
        [STALE_CHUNK_RELOAD_KEY]: String(T0 - STALE_CHUNK_RELOAD_WINDOW_MS + 1),
      },
    })
    expect(await recovery.recover()).toBe('failed')
    expect(flush).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads again once the window has passed', async () => {
    const { reload, recovery } = setup({
      stored: {
        [STALE_CHUNK_RELOAD_KEY]: String(T0 - STALE_CHUNK_RELOAD_WINDOW_MS),
      },
    })
    expect(await recovery.recover()).toBe('reloading')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores a garbage mark', async () => {
    const { recovery } = setup({
      stored: { [STALE_CHUNK_RELOAD_KEY]: 'nope' },
    })
    expect(await recovery.recover()).toBe('reloading')
  })

  it('keeps the page when the save fails', async () => {
    const { storage, reload, recovery } = setup({
      flush: () => Promise.resolve(false),
    })
    expect(await recovery.recover()).toBe('failed')
    expect(reload).not.toHaveBeenCalled()
    expect(storage.map.has(STALE_CHUNK_RELOAD_KEY)).toBe(false)
  })

  it('keeps the page when storage or save throws', async () => {
    const blocked = setup({
      storage: {
        getItem: () => {
          throw new DOMException('blocked', 'SecurityError')
        },
        setItem: () => undefined,
      },
    })
    expect(await blocked.recovery.recover()).toBe('failed')
    expect(blocked.reload).not.toHaveBeenCalled()

    const throwing = setup({ flush: () => Promise.reject(new Error('io')) })
    expect(await throwing.recovery.reloadNow()).toBe('failed')
    expect(throwing.reload).not.toHaveBeenCalled()
  })

  it('manual reload ignores the guard but still saves and marks', async () => {
    const { storage, reload, flush, recovery } = setup({
      stored: { [STALE_CHUNK_RELOAD_KEY]: String(T0 - 1) },
      now: () => T0 + 5,
    })
    expect(await recovery.recover()).toBe('failed')
    expect(await recovery.reloadNow()).toBe('reloading')
    expect(flush).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.map.get(STALE_CHUNK_RELOAD_KEY)).toBe(String(T0 + 5))
  })

  it('manual reload stops on a failed save unless told to discard', async () => {
    const { reload, recovery } = setup({
      flush: () => Promise.resolve(false),
    })
    expect(await recovery.reloadNow()).toBe('failed')
    expect(reload).not.toHaveBeenCalled()
    expect(await recovery.reloadNow(true)).toBe('reloading')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

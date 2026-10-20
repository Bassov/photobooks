import { beforeEach, describe, expect, it, vi } from 'vitest'

const mountPhotobooks = vi.fn()

vi.mock('./ui/mountPhotobooks', () => ({
  mountPhotobooks,
}))

describe('main entry', () => {
  beforeEach(() => {
    mountPhotobooks.mockClear()
    vi.resetModules()
  })

  it('mounts the product on import with session wiring', async () => {
    await import('./main')
    expect(mountPhotobooks).toHaveBeenCalledOnce()
    const arg = mountPhotobooks.mock.calls[0]?.[0] as {
      configureSession?: unknown
      createSessionDeps?: unknown
    }
    expect(typeof arg.configureSession).toBe('function')
    expect(typeof arg.createSessionDeps).toBe('function')
  })
})

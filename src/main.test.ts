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

  it('mounts the product on import', async () => {
    await import('./main')
    expect(mountPhotobooks).toHaveBeenCalledOnce()
  })
})

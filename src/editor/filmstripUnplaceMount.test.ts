import { describe, expect, it, vi } from 'vitest'
import * as galleryDrop from './galleryDrop'
import { installFilmstripUnplaceWhenMounted } from './filmstripUnplaceMount'

describe('installFilmstripUnplaceWhenMounted', () => {
  it('returns undefined when the node is null', () => {
    const spy = vi.spyOn(galleryDrop, 'installFilmstripUnplace')
    expect(installFilmstripUnplaceWhenMounted(null)).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('installs unplace handlers when the node is present', () => {
    const cleanup = vi.fn()
    const spy = vi
      .spyOn(galleryDrop, 'installFilmstripUnplace')
      .mockReturnValue(cleanup)
    const node = document.createElement('div')
    expect(installFilmstripUnplaceWhenMounted(node)).toBe(cleanup)
    expect(spy).toHaveBeenCalledWith(node)
    spy.mockRestore()
  })
})

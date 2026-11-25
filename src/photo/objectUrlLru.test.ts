import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFERRED_REVOKE_RECHECK_MS,
  getDeferredRevokeCountForTests,
} from '../lib/objectUrlRevoke'
import { ObjectUrlLru } from './objectUrlLru'

describe('ObjectUrlLru', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores and returns urls', () => {
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:a')
    expect(lru.get('a')).toBe('blob:a')
    expect(lru.size).toBe(1)
  })

  it('evicts oldest and revokes on capacity overflow', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:a')
    lru.set('b', 'blob:b')
    lru.set('c', 'blob:c')
    expect(lru.has('a')).toBe(false)
    expect(lru.get('b')).toBe('blob:b')
    expect(lru.get('c')).toBe('blob:c')
    expect(revoke).toHaveBeenCalledWith('blob:a')
  })

  it('promotes on get so recently used survives eviction', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:a')
    lru.set('b', 'blob:b')
    expect(lru.get('a')).toBe('blob:a')
    lru.set('c', 'blob:c')
    expect(lru.has('b')).toBe(false)
    expect(lru.has('a')).toBe(true)
    expect(revoke).toHaveBeenCalledWith('blob:b')
  })

  it('clear revokes all urls', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 3 })
    lru.set('a', 'blob:a')
    lru.set('b', 'blob:b')
    lru.clear()
    expect(lru.size).toBe(0)
    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(revoke).toHaveBeenCalledWith('blob:b')
  })

  it('rejects capacity below 1', () => {
    expect(() => new ObjectUrlLru({ capacity: 0 })).toThrow(/capacity/)
  })

  it('returns undefined for missing keys without promoting', () => {
    const lru = new ObjectUrlLru({ capacity: 2 })
    expect(lru.get('missing')).toBeUndefined()
    expect(lru.has('missing')).toBe(false)
  })

  it('replaces an existing key and revokes the previous url when different', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:old')
    lru.set('a', 'blob:new')
    expect(lru.get('a')).toBe('blob:new')
    expect(revoke).toHaveBeenCalledWith('blob:old')
    expect(lru.size).toBe(1)
  })

  it('does not revoke when setting the same url again', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:same')
    lru.set('a', 'blob:same')
    expect(revoke).not.toHaveBeenCalled()
    expect(lru.get('a')).toBe('blob:same')
  })

  describe('a URL still referenced by a mounted element', () => {
    afterEach(() => {
      document.body.replaceChildren()
      vi.useRealTimers()
    })

    function mountImage(attr: 'src' | 'srcset', value: string) {
      const img = document.createElement('img')
      img.setAttribute(attr, value)
      document.body.append(img)
      return img
    }

    it('eviction keeps the cap but holds the revoke until the img drops the URL', async () => {
      vi.useFakeTimers()
      const revoke = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined)
      const img = mountImage('src', 'blob:held')
      const lru = new ObjectUrlLru({ capacity: 2 })
      lru.set('a', 'blob:held')
      lru.set('b', 'blob:b')
      lru.set('c', 'blob:c')
      expect(lru.size).toBe(2)
      expect(lru.has('a')).toBe(false)
      expect(revoke).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
      expect(revoke).not.toHaveBeenCalled()

      img.setAttribute('src', 'blob:c')
      await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
      expect(revoke).toHaveBeenCalledWith('blob:held')
      expect(revoke).toHaveBeenCalledTimes(1)
      expect(getDeferredRevokeCountForTests()).toBe(0)
    })

    it('replace, delete and clear hold URLs a srcset still lists', async () => {
      vi.useFakeTimers()
      const revoke = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined)
      const img = mountImage('srcset', 'blob:old 320w, blob:d 640w')
      const lru = new ObjectUrlLru({ capacity: 4 })
      lru.set('a', 'blob:old')
      lru.set('a', 'blob:new')
      lru.set('d', 'blob:d')
      lru.delete('d')
      lru.set('e', 'blob:e')
      lru.clear()
      expect(revoke.mock.calls).toEqual([['blob:new'], ['blob:e']])

      img.remove()
      await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
      expect(revoke).toHaveBeenCalledWith('blob:old')
      expect(revoke).toHaveBeenCalledWith('blob:d')
      expect(revoke).toHaveBeenCalledTimes(4)
    })
  })

  it('delete removes and revokes; missing delete returns false', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const lru = new ObjectUrlLru({ capacity: 2 })
    lru.set('a', 'blob:a')
    expect(lru.delete('a')).toBe(true)
    expect(lru.has('a')).toBe(false)
    expect(revoke).toHaveBeenCalledWith('blob:a')
    expect(lru.delete('a')).toBe(false)
  })
})

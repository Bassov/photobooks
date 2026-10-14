import { afterEach, describe, expect, it, vi } from 'vitest'
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
})

import { describe, expect, it } from 'vitest'
import { PendingJobIndex } from './pendingJobIndex'

function job(assetId: string): { assetId: string } {
  return { assetId }
}

describe('PendingJobIndex', () => {
  it('reports an asset while any of its jobs is tracked', () => {
    const index = new PendingJobIndex<{ assetId: string }>()
    const first = job('a')
    const second = job('a')

    index.add(first)
    index.add(second)
    index.delete(first)

    expect(index.has('a')).toBe(true)
    index.delete(second)
    expect(index.has('a')).toBe(false)
  })

  it('counts a job once however often it is added or deleted', () => {
    const index = new PendingJobIndex<{ assetId: string }>()
    const once = job('a')
    const other = job('a')

    index.add(once)
    index.add(once)
    index.add(other)
    index.delete(once)
    index.delete(once)

    expect(index.has('a')).toBe(true)
    index.delete(other)
    expect(index.has('a')).toBe(false)
  })

  it('ignores deleting a job it never tracked', () => {
    const index = new PendingJobIndex<{ assetId: string }>()
    index.add(job('a'))

    index.delete(job('a'))
    index.delete(job('b'))

    expect(index.has('a')).toBe(true)
    expect(index.has('b')).toBe(false)
  })

  it('clear forgets every job', () => {
    const index = new PendingJobIndex<{ assetId: string }>()
    const tracked = job('a')
    index.add(tracked)
    index.add(job('b'))

    index.clear()

    expect(index.has('a')).toBe(false)
    expect(index.has('b')).toBe(false)
    index.add(tracked)
    expect(index.has('a')).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDragSource, setDragSource } from './dropHover'

describe('drag source', () => {
  afterEach(() => {
    clearDragSource()
  })

  it('marks one frame at a time and clears at dragend', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    setDragSource(a)
    expect(a.getAttribute('data-drag-source')).toBe('true')
    setDragSource(b)
    expect(a.hasAttribute('data-drag-source')).toBe(false)
    expect(b.getAttribute('data-drag-source')).toBe('true')
    document.dispatchEvent(new Event('dragend'))
    expect(b.hasAttribute('data-drag-source')).toBe(false)
  })

  it('drops its dragend listener once cleared', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    setDragSource(document.createElement('div'))
    expect(remove).not.toHaveBeenCalledWith('dragend', clearDragSource)
    document.dispatchEvent(new Event('dragend'))
    expect(remove).toHaveBeenCalledWith('dragend', clearDragSource)
    remove.mockRestore()
  })
})

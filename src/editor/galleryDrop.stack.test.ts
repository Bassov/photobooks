import { describe, expect, it } from 'vitest'
import { insetFromRects, stackInset, stackPoint } from './galleryDrop'

describe('insetFromRects', () => {
  it('centres the stack horizontally and measures the lead above the first slot', () => {
    expect(insetFromRects({ width: 1000, top: 10 }, { top: 66 }, 400)).toEqual({
      insetX: 300,
      insetY: 56,
    })
  })

  it('has no inset when nothing is laid out or the stack fills the world', () => {
    expect(insetFromRects({ width: 400, top: 10 }, undefined, 400)).toEqual({
      insetX: 0,
      insetY: 0,
    })
    expect(insetFromRects({ width: 300, top: 10 }, { top: 5 }, 400)).toEqual({
      insetX: 0,
      insetY: 0,
    })
  })
})

function rect(partial: Partial<DOMRect>): DOMRect {
  return { width: 0, top: 0, ...partial } as DOMRect
}

describe('stackInset', () => {
  it('is zero without a world element', () => {
    const scroll = document.createElement('div')
    expect(stackInset(scroll, 400)).toEqual({ insetX: 0, insetY: 0 })
  })

  it('reads the world box and its first slot from layout', () => {
    const scroll = document.createElement('div')
    const world = document.createElement('div')
    world.dataset.testid = 'pasteboard-world'
    const slot = document.createElement('div')
    world.append(slot)
    scroll.append(world)
    world.getBoundingClientRect = () => rect({ width: 1000, top: 10 })
    slot.getBoundingClientRect = () => rect({ top: 66 })
    expect(stackInset(scroll, 400)).toEqual({ insetX: 300, insetY: 56 })
  })

  it('has no vertical inset for an empty world', () => {
    const scroll = document.createElement('div')
    const world = document.createElement('div')
    world.dataset.testid = 'pasteboard-world'
    scroll.append(world)
    world.getBoundingClientRect = () => rect({ width: 1000, top: 10 })
    expect(stackInset(scroll, 400)).toEqual({ insetX: 300, insetY: 0 })
  })
})

describe('stackPoint', () => {
  it('moves client coordinates into stack space', () => {
    expect(
      stackPoint(
        { clientX: 500, clientY: 400 },
        { originX: 100, originY: 50, insetX: 30, insetY: 56 },
        { scrollLeft: 7, scrollTop: 200 },
      ),
    ).toEqual({ x: 377, y: 494 })
  })
})

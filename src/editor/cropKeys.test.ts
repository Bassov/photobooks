import { describe, expect, it } from 'vitest'
import { cycledIndex, pinnedCropKey } from './cropKeys'

const key = (
  name: string,
  mods: Partial<{
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
  }> = {},
) => ({
  key: name,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('pinnedCropKey', () => {
  it('exits on Escape, even with a modifier', () => {
    expect(pinnedCropKey(key('Escape'))).toEqual({ kind: 'exit' })
    expect(pinnedCropKey(key('Escape', { metaKey: true }))).toEqual({
      kind: 'exit',
    })
  })

  it('cycles on Tab, backwards with Shift', () => {
    expect(pinnedCropKey(key('Tab'))).toEqual({ kind: 'tab', back: false })
    expect(pinnedCropKey(key('Tab', { shiftKey: true }))).toEqual({
      kind: 'tab',
      back: true,
    })
  })

  it.each([
    ['ArrowLeft', -1, 0],
    ['ArrowRight', 1, 0],
    ['ArrowUp', 0, -1],
    ['ArrowDown', 0, 1],
  ])('nudges 1 px on %s', (name, dx, dy) => {
    expect(pinnedCropKey(key(name))).toEqual({ kind: 'nudge', dx, dy })
  })

  it('nudges 10 px with Shift', () => {
    expect(pinnedCropKey(key('ArrowRight', { shiftKey: true }))).toEqual({
      kind: 'nudge',
      dx: 10,
      dy: 0,
    })
    expect(pinnedCropKey(key('ArrowUp', { shiftKey: true }))).toEqual({
      kind: 'nudge',
      dx: 0,
      dy: -10,
    })
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves modified arrows and Tab to the editor (%o)',
    (mods) => {
      expect(pinnedCropKey(key('ArrowRight', mods))).toBeNull()
      expect(pinnedCropKey(key('Tab', mods))).toBeNull()
    },
  )

  it('ignores other keys', () => {
    expect(pinnedCropKey(key('a'))).toBeNull()
    expect(pinnedCropKey(key('Enter'))).toBeNull()
  })
})

describe('cycledIndex', () => {
  it('starts at the first handle, or the last going back', () => {
    expect(cycledIndex(-1, 4, false)).toBe(0)
    expect(cycledIndex(-1, 4, true)).toBe(3)
  })

  it('walks forward and wraps', () => {
    expect(cycledIndex(0, 4, false)).toBe(1)
    expect(cycledIndex(3, 4, false)).toBe(0)
  })

  it('walks back and wraps', () => {
    expect(cycledIndex(2, 4, true)).toBe(1)
    expect(cycledIndex(0, 4, true)).toBe(3)
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getGridVisible,
  getSnapOn,
  setGridVisible,
  setSnapOn,
} from './gridView'
import { installEditorGridKeys } from './installEditorGridKeys'
import { getRulersVisible, setRulersVisible } from './rulersView'

function press(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('installEditorGridKeys', () => {
  let off: () => void
  beforeEach(() => {
    off = installEditorGridKeys()
  })
  afterEach(() => {
    off()
    setGridVisible(false)
    setSnapOn(true)
    setRulersVisible(false)
  })

  it("Ctrl+' and Cmd+' flip the grid and swallow the key", () => {
    expect(press({ key: "'", ctrlKey: true }).defaultPrevented).toBe(true)
    expect(getGridVisible()).toBe(true)
    expect(press({ key: "'", metaKey: true }).defaultPrevented).toBe(true)
    expect(getGridVisible()).toBe(false)
  })

  it("a bare ' or another Ctrl key leaves the grid alone", () => {
    expect(press({ key: "'" }).defaultPrevented).toBe(false)
    press({ key: ';', ctrlKey: true })
    expect(getGridVisible()).toBe(false)
  })

  it('Shift+S flips snap and swallows the key', () => {
    expect(press({ key: 'S', shiftKey: true }).defaultPrevented).toBe(true)
    expect(getSnapOn()).toBe(false)
    press({ key: 'S', shiftKey: true })
    expect(getSnapOn()).toBe(true)
  })

  it('Shift+R flips rulers and swallows the key', () => {
    expect(press({ key: 'R', shiftKey: true }).defaultPrevented).toBe(true)
    expect(getRulersVisible()).toBe(true)
    press({ key: 'R', shiftKey: true })
    expect(getRulersVisible()).toBe(false)
  })

  it('plain R, Ctrl+Shift+R, typing targets and repeat leave rulers alone', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const presses: [KeyboardEventInit, EventTarget?][] = [
      [{ key: 'r' }],
      [{ key: 'X', shiftKey: true }],
      [{ key: 'R', shiftKey: true, ctrlKey: true }],
      [{ key: 'R', shiftKey: true, metaKey: true }],
      [{ key: 'R', shiftKey: true, repeat: true }],
      [{ key: 'R', shiftKey: true, altKey: true }],
      [{ key: 'R', shiftKey: true }, input],
    ]
    for (const [init, target] of presses) {
      press(init, target)
      expect(getRulersVisible()).toBe(false)
    }
    input.remove()
  })

  it('plain S, Shift+other, Ctrl+Shift+S and Cmd+Shift+S do not touch snap', () => {
    press({ key: 's' })
    press({ key: 'X', shiftKey: true })
    press({ key: 'S', shiftKey: true, ctrlKey: true })
    press({ key: 'S', shiftKey: true, metaKey: true })
    expect(getSnapOn()).toBe(true)
  })

  it("ignores repeat, Alt and Ctrl+Shift+' ", () => {
    press({ key: "'", ctrlKey: true, repeat: true })
    press({ key: "'", ctrlKey: true, altKey: true })
    press({ key: "'", ctrlKey: true, shiftKey: true })
    press({ key: 'S', shiftKey: true, repeat: true })
    press({ key: 'S', shiftKey: true, altKey: true })
    expect(getGridVisible()).toBe(false)
    expect(getSnapOn()).toBe(true)
  })

  it('ignores typing targets', () => {
    const input = document.createElement('input')
    document.body.append(input)
    press({ key: 'S', shiftKey: true }, input)
    press({ key: "'", ctrlKey: true }, input)
    input.remove()
    expect(getGridVisible()).toBe(false)
    expect(getSnapOn()).toBe(true)
  })

  it('stops listening after cleanup', () => {
    off()
    press({ key: "'", ctrlKey: true })
    expect(getGridVisible()).toBe(false)
  })
})

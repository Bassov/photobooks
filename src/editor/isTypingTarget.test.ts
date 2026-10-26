import { describe, expect, it } from 'vitest'
import { isTypingTarget, shouldDeferChromeSpacePan } from './isTypingTarget'

describe('isTypingTarget', () => {
  it('detects text inputs, textarea, and contenteditable', () => {
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget(document.createTextNode('x'))).toBe(false)

    const input = document.createElement('input')
    input.type = 'text'
    expect(isTypingTarget(input)).toBe(true)
    input.type = 'checkbox'
    expect(isTypingTarget(input)).toBe(false)
    input.type = 'file'
    expect(isTypingTarget(input)).toBe(false)

    const area = document.createElement('textarea')
    expect(isTypingTarget(area)).toBe(true)

    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(isTypingTarget(editable)).toBe(true)
    editable.contentEditable = 'false'
    expect(isTypingTarget(editable)).toBe(false)

    const div = document.createElement('div')
    expect(isTypingTarget(div)).toBe(false)
  })

  it('defers chrome Space pan for filmstrip and activatable controls', () => {
    expect(shouldDeferChromeSpacePan(null)).toBe(false)
    const text = document.createElement('input')
    text.type = 'text'
    expect(shouldDeferChromeSpacePan(text)).toBe(true)
    const radio = document.createElement('input')
    radio.type = 'radio'
    expect(shouldDeferChromeSpacePan(radio)).toBe(true)
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    expect(shouldDeferChromeSpacePan(checkbox)).toBe(true)
    const range = document.createElement('input')
    range.type = 'range'
    expect(shouldDeferChromeSpacePan(range)).toBe(false)
    const film = document.createElement('div')
    film.dataset.testid = 'filmstrip'
    const tile = document.createElement('div')
    film.appendChild(tile)
    expect(shouldDeferChromeSpacePan(tile)).toBe(true)
    const btn = document.createElement('button')
    expect(shouldDeferChromeSpacePan(btn)).toBe(true)
    expect(shouldDeferChromeSpacePan(document.createElement('div'))).toBe(false)
  })
})

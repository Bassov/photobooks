import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './isTypingTarget'

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
})

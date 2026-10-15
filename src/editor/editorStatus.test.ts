import { afterEach, describe, expect, it } from 'vitest'
import {
  getEditorStatus,
  setEditorStatus,
  subscribeEditorStatus,
  unplacedFromSpreadStatus,
} from './editorStatus'

describe('editorStatus', () => {
  afterEach(() => {
    setEditorStatus('')
  })

  it('notifies subscribers until they unsubscribe and ignores the same text', () => {
    let calls = 0
    const unsubscribe = subscribeEditorStatus(() => {
      calls += 1
    })
    setEditorStatus('Photos swapped')
    setEditorStatus('Photos swapped')
    expect(calls).toBe(1)
    expect(getEditorStatus()).toBe('Photos swapped')
    unsubscribe()
    setEditorStatus('Photo moved')
    expect(calls).toBe(1)
    expect(getEditorStatus()).toBe('Photo moved')
  })

  it.each([
    [1, '1 photo was unplaced from the spread'],
    [3, '3 photos were unplaced from the spread'],
  ])('states %i unplaced photos as %s', (count, sentence) => {
    expect(unplacedFromSpreadStatus(count)).toBe(sentence)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import {
  getEditorStatus,
  setEditorStatus,
  subscribeEditorStatus,
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
})

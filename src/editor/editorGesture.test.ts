import { afterEach, describe, expect, it } from 'vitest'
import {
  installDocumentDragGesture,
  isEditorGestureActive,
  resetEditorGestureForTests,
  setEditorGestureActive,
  subscribeEditorGesture,
} from './editorGesture'

describe('editorGesture', () => {
  afterEach(() => {
    resetEditorGestureForTests()
  })

  it('tracks nested begin/end pairs', () => {
    expect(isEditorGestureActive()).toBe(false)
    setEditorGestureActive(true)
    setEditorGestureActive(true)
    expect(isEditorGestureActive()).toBe(true)
    setEditorGestureActive(false)
    expect(isEditorGestureActive()).toBe(true)
    setEditorGestureActive(false)
    expect(isEditorGestureActive()).toBe(false)
  })

  it('notifies subscribers when activity changes', () => {
    const seen: boolean[] = []
    const unsubscribe = subscribeEditorGesture(() => {
      seen.push(isEditorGestureActive())
    })
    setEditorGestureActive(true)
    setEditorGestureActive(true)
    setEditorGestureActive(false)
    setEditorGestureActive(false)
    unsubscribe()
    expect(seen).toEqual([true, false])
  })

  it('stops notifying after unsubscribe', () => {
    let calls = 0
    const unsubscribe = subscribeEditorGesture(() => {
      calls += 1
    })
    unsubscribe()
    setEditorGestureActive(true)
    expect(calls).toBe(0)
  })

  it('installDocumentDragGesture toggles on dragstart/dragend', () => {
    const removed: string[] = []
    const originalRemove = document.removeEventListener.bind(document)
    document.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      removed.push(type)
      originalRemove(type, listener, options)
    }) as typeof document.removeEventListener

    const uninstall = installDocumentDragGesture()
    document.dispatchEvent(new Event('dragstart'))
    expect(isEditorGestureActive()).toBe(true)
    document.dispatchEvent(new Event('dragend'))
    expect(isEditorGestureActive()).toBe(false)
    uninstall()
    expect(removed).toEqual(['dragstart', 'dragend'])
    document.removeEventListener = originalRemove
    document.dispatchEvent(new Event('dragstart'))
    expect(isEditorGestureActive()).toBe(false)
  })

  it('reset clears nested depth', () => {
    setEditorGestureActive(true)
    setEditorGestureActive(true)
    resetEditorGestureForTests()
    expect(isEditorGestureActive()).toBe(false)
  })
})

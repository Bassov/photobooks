import { describe, expect, it } from 'vitest'
import { editorKeysSuspended, suspendEditorKeys } from './editorKeysGate'

describe('editorKeysGate', () => {
  it('suspends until every holder resumes; a second resume is a no-op', () => {
    expect(editorKeysSuspended()).toBe(false)
    const a = suspendEditorKeys()
    const b = suspendEditorKeys()
    expect(editorKeysSuspended()).toBe(true)
    a()
    a()
    expect(editorKeysSuspended()).toBe(true)
    b()
    expect(editorKeysSuspended()).toBe(false)
  })
})

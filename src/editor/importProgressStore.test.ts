import { describe, expect, it, vi } from 'vitest'
import {
  getImportProgress,
  resetImportProgressForTests,
  setImportProgress,
  subscribeImportProgress,
} from './importProgressStore'

describe('importProgressStore', () => {
  it('notifies subscribers when progress changes and no-ops on same ref', () => {
    resetImportProgressForTests()
    const listener = vi.fn()
    const unsubscribe = subscribeImportProgress(listener)
    const state = {
      total: 2,
      completed: 1,
      errors: [],
      running: true,
    }
    setImportProgress(state)
    expect(getImportProgress()).toBe(state)
    expect(listener).toHaveBeenCalledTimes(1)
    setImportProgress(state)
    expect(listener).toHaveBeenCalledTimes(1)
    setImportProgress(null)
    expect(getImportProgress()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})

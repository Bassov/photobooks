import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isDecodeScrollQuiet,
  noteDecodeScrollActivity,
  resetDecodeScrollQuietForTests,
} from './decodeScrollQuiet'

describe('decodeScrollQuiet', () => {
  afterEach(() => {
    resetDecodeScrollQuietForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('noteDecodeScrollActivity opens a quiet window that expires', () => {
    vi.useFakeTimers()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    expect(isDecodeScrollQuiet()).toBe(false)
    noteDecodeScrollActivity(200)
    expect(isDecodeScrollQuiet()).toBe(true)
    now = 1_199
    expect(isDecodeScrollQuiet()).toBe(true)
    now = 1_200
    expect(isDecodeScrollQuiet()).toBe(false)
  })

  it('noteDecodeScrollActivity(0) and negative leave quiet closed', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(5_000)
    noteDecodeScrollActivity(0)
    expect(isDecodeScrollQuiet()).toBe(false)
    noteDecodeScrollActivity(-10)
    expect(isDecodeScrollQuiet()).toBe(false)
  })

  it('resetDecodeScrollQuietForTests clears an open window', () => {
    noteDecodeScrollActivity(1_000)
    expect(isDecodeScrollQuiet()).toBe(true)
    resetDecodeScrollQuietForTests()
    expect(isDecodeScrollQuiet()).toBe(false)
  })
})

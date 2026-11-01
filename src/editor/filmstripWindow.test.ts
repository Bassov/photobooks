import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFilmstripWindow,
  resetFilmstripWindowForTests,
  setFilmstripWindow,
  subscribeFilmstripWindow,
} from './filmstripWindow'

const EMPTY = { order: [], start: 0, end: 0, direction: 0 }

describe('filmstripWindow', () => {
  afterEach(() => {
    resetFilmstripWindowForTests()
  })

  it('starts empty and holds the last published window', () => {
    expect(getFilmstripWindow()).toEqual(EMPTY)
    const next = { order: ['a', 'b'], start: 1, end: 2, direction: 1 } as const
    setFilmstripWindow(next)
    expect(getFilmstripWindow()).toBe(next)
  })

  it('notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeFilmstripWindow(listener)
    setFilmstripWindow({ order: ['a'], start: 0, end: 1, direction: 0 })
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setFilmstripWindow({ order: ['b'], start: 0, end: 1, direction: 0 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reset drops the window and every subscriber', () => {
    const listener = vi.fn()
    subscribeFilmstripWindow(listener)
    setFilmstripWindow({ order: ['a'], start: 0, end: 1, direction: -1 })
    resetFilmstripWindowForTests()
    expect(getFilmstripWindow()).toEqual(EMPTY)
    setFilmstripWindow({ order: ['b'], start: 0, end: 1, direction: 0 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

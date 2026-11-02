import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFilmstripAnchor,
  getFilmstripCurrentRow,
  getFilmstripRowFocus,
  noteFilmstripRowBlur,
  noteFilmstripRowFocus,
  requestFilmstripRowFocus,
  resetFilmstripGridFocus,
  ROW_FOCUS_VISIBLE,
  ROW_FOCUSED,
  ROW_TAB_STOP,
  setFilmstripAnchor,
  subscribeFilmstripFocus,
  takeFilmstripPendingFocus,
} from './filmstripGridFocus'

const FOCUSED = ROW_TAB_STOP | ROW_FOCUSED

describe('filmstripGridFocus', () => {
  afterEach(() => {
    resetFilmstripGridFocus()
  })

  it('has no roving row until one takes focus', () => {
    expect(getFilmstripCurrentRow()).toBeNull()
    expect(getFilmstripRowFocus('a')).toBe(0)
  })

  it('makes the focused row the tab stop; other rows read 0', () => {
    noteFilmstripRowFocus('a', false)

    expect(getFilmstripCurrentRow()).toBe('a')
    expect(getFilmstripRowFocus('a')).toBe(FOCUSED)
    expect(getFilmstripRowFocus('b')).toBe(0)

    noteFilmstripRowFocus('a', true)
    expect(getFilmstripRowFocus('a')).toBe(FOCUSED | ROW_FOCUS_VISIBLE)
  })

  it('emits only when the focus snapshot changes', () => {
    const listener = vi.fn()
    const stop = subscribeFilmstripFocus(listener)

    noteFilmstripRowFocus('a', false)
    noteFilmstripRowFocus('a', false)
    expect(listener).toHaveBeenCalledTimes(1)

    noteFilmstripRowFocus('a', true)
    expect(listener).toHaveBeenCalledTimes(2)

    noteFilmstripRowFocus('b', true)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(getFilmstripRowFocus('a')).toBe(0)

    stop()
    noteFilmstripRowFocus('c', false)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('re-emits when a blurred row takes focus again', () => {
    noteFilmstripRowFocus('a', false)
    noteFilmstripRowBlur('a')
    const listener = vi.fn()
    subscribeFilmstripFocus(listener)

    noteFilmstripRowFocus('a', false)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getFilmstripRowFocus('a')).toBe(FOCUSED)
  })

  it('keeps a blurred row as the tab stop without focus-visible', () => {
    noteFilmstripRowFocus('a', true)
    const listener = vi.fn()
    subscribeFilmstripFocus(listener)

    noteFilmstripRowBlur('a')
    noteFilmstripRowBlur('a')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getFilmstripCurrentRow()).toBe('a')
    expect(getFilmstripRowFocus('a')).toBe(ROW_TAB_STOP)
  })

  it('ignores a blur from a row that is not focused', () => {
    noteFilmstripRowFocus('a', true)
    const listener = vi.fn()
    subscribeFilmstripFocus(listener)

    noteFilmstripRowBlur('b')

    expect(listener).not.toHaveBeenCalled()
    expect(getFilmstripRowFocus('a')).toBe(FOCUSED | ROW_FOCUS_VISIBLE)
  })

  it('hands a pending focus to its row once', () => {
    requestFilmstripRowFocus('z')

    expect(takeFilmstripPendingFocus('a')).toBe(false)
    expect(takeFilmstripPendingFocus('z')).toBe(true)
    expect(takeFilmstripPendingFocus('z')).toBe(false)
  })

  it('drops a pending focus once another row takes focus', () => {
    noteFilmstripRowFocus('a', false)
    requestFilmstripRowFocus('z')

    noteFilmstripRowFocus('a', false)

    expect(takeFilmstripPendingFocus('z')).toBe(false)
  })

  it('reset clears row, anchor and pending focus and notifies', () => {
    noteFilmstripRowFocus('a', true)
    setFilmstripAnchor('a')
    requestFilmstripRowFocus('z')
    const listener = vi.fn()
    subscribeFilmstripFocus(listener)

    resetFilmstripGridFocus()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getFilmstripCurrentRow()).toBeNull()
    expect(getFilmstripRowFocus('a')).toBe(0)
    expect(getFilmstripAnchor()).toBeNull()
    expect(takeFilmstripPendingFocus('z')).toBe(false)
  })
})

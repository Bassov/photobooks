import { describe, expect, it } from 'vitest'
import {
  filmstripNavTarget,
  isFilmstripNavKey,
  navigateFilmstrip,
  pickFilmstripItem,
  selectAllFilmstrip,
  type FilmstripSelectionInput,
} from './filmstripSelection'

const order = ['a', 'b', 'c', 'd', 'e']
const plain = { shift: false, toggle: false }
const shift = { shift: true, toggle: false }
const toggle = { shift: false, toggle: true }

function input(
  selected: readonly string[],
  anchor: string | null,
): FilmstripSelectionInput {
  return { order, selected, anchor }
}

describe('pickFilmstripItem', () => {
  it('replaces the selection on a plain click and anchors there', () => {
    expect(pickFilmstripItem(input(['a', 'b'], 'a'), 'd', plain)).toEqual({
      ids: ['d'],
      primary: 'd',
      anchor: 'd',
    })
  })

  it('selects the anchor→id range in view order on Shift, either way', () => {
    expect(pickFilmstripItem(input(['b'], 'b'), 'd', shift)).toEqual({
      ids: ['b', 'c', 'd'],
      primary: 'd',
      anchor: 'b',
    })
    expect(pickFilmstripItem(input(['d'], 'd'), 'a', shift)).toEqual({
      ids: ['a', 'b', 'c', 'd'],
      primary: 'a',
      anchor: 'd',
    })
    expect(pickFilmstripItem(input(['c'], 'c'), 'c', shift).ids).toEqual(['c'])
    expect(pickFilmstripItem(input(['a'], 'a'), 'c', shift).ids).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('falls back to a plain pick on Shift without a usable anchor', () => {
    const fresh = { ids: ['c'], primary: 'c', anchor: 'c' }
    expect(pickFilmstripItem(input([], null), 'c', shift)).toEqual(fresh)
    expect(pickFilmstripItem(input(['x'], 'x'), 'c', shift)).toEqual(fresh)
    expect(pickFilmstripItem(input(['a'], 'a'), 'gone', shift).ids).toEqual([
      'gone',
    ])
  })

  it('adds an unselected photo on Ctrl / Meta and makes it primary', () => {
    expect(pickFilmstripItem(input(['a'], 'a'), 'c', toggle)).toEqual({
      ids: ['a', 'c'],
      primary: 'c',
      anchor: 'c',
    })
  })

  it('removes a selected photo on Ctrl / Meta; primary is the last left', () => {
    expect(pickFilmstripItem(input(['a', 'b', 'c'], 'a'), 'b', toggle)).toEqual(
      { ids: ['a', 'c'], primary: 'c', anchor: 'b' },
    )
    expect(pickFilmstripItem(input(['b'], 'b'), 'b', toggle)).toEqual({
      ids: [],
      primary: null,
      anchor: 'b',
    })
  })
})

describe('selectAllFilmstrip', () => {
  it('selects the whole view and keeps the anchor', () => {
    expect(selectAllFilmstrip(input(['b'], 'b'))).toEqual({
      ids: order,
      primary: 'e',
      anchor: 'b',
    })
    expect(
      selectAllFilmstrip({ order: [], selected: [], anchor: null }).primary,
    ).toBeNull()
  })
})

describe('filmstripNavTarget', () => {
  it('steps one row and clamps at both ends', () => {
    expect(filmstripNavTarget(order, 'c', 'ArrowRight')).toBe('d')
    expect(filmstripNavTarget(order, 'c', 'ArrowLeft')).toBe('b')
    expect(filmstripNavTarget(order, 'e', 'ArrowRight')).toBe('e')
    expect(filmstripNavTarget(order, 'a', 'ArrowLeft')).toBe('a')
  })

  it('jumps to the first / last row on Home / End', () => {
    expect(filmstripNavTarget(order, 'c', 'Home')).toBe('a')
    expect(filmstripNavTarget(order, 'c', 'End')).toBe('e')
  })

  it('starts from the first row without a focused one (End: last)', () => {
    expect(filmstripNavTarget(order, null, 'ArrowRight')).toBe('a')
    expect(filmstripNavTarget(order, 'gone', 'ArrowLeft')).toBe('a')
    expect(filmstripNavTarget(order, null, 'End')).toBe('e')
  })

  it('has no target in an empty view', () => {
    expect(filmstripNavTarget([], 'a', 'Home')).toBeNull()
    expect(filmstripNavTarget([], 'a', 'End')).toBeNull()
    expect(filmstripNavTarget([], null, 'ArrowRight')).toBeNull()
    expect(filmstripNavTarget([], null, 'ArrowLeft')).toBeNull()
  })
})

describe('navigateFilmstrip', () => {
  it('moves focus and selects the target', () => {
    expect(
      navigateFilmstrip(input(['b'], 'b'), 'b', 'ArrowRight', plain),
    ).toEqual({
      focus: 'c',
      pick: { ids: ['c'], primary: 'c', anchor: 'c' },
    })
  })

  it('extends from the anchor (else the focused row) on Shift', () => {
    expect(
      navigateFilmstrip(input(['b'], 'b'), 'c', 'ArrowRight', shift)?.pick?.ids,
    ).toEqual(['b', 'c', 'd'])
    expect(
      navigateFilmstrip(input([], null), 'c', 'ArrowRight', shift)?.pick,
    ).toEqual({ ids: ['c', 'd'], primary: 'd', anchor: 'c' })
  })

  it('moves focus only on Ctrl / Meta', () => {
    expect(navigateFilmstrip(input(['b'], 'b'), 'b', 'End', toggle)).toEqual({
      focus: 'e',
      pick: null,
    })
  })

  it('does nothing in an empty view', () => {
    expect(
      navigateFilmstrip(
        { order: [], selected: [], anchor: null },
        null,
        'Home',
        plain,
      ),
    ).toBeNull()
  })
})

describe('isFilmstripNavKey', () => {
  it('accepts arrows left / right, Home and End only', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(isFilmstripNavKey(key)).toBe(true)
    }
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'a']) {
      expect(isFilmstripNavKey(key)).toBe(false)
    }
  })
})

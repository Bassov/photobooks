import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  deriveGalleryView,
  parseCapturedAtMs,
  projectOntoView,
  type GalleryViewSource,
} from './galleryView'

function source(
  names: Record<string, string>,
  times: Record<string, number | null> = {},
  placed: readonly string[] = [],
): GalleryViewSource {
  return {
    name: (id) => names[id] ?? id,
    timeMs: (id) => times[id] ?? null,
    isPlaced: (id) => placed.includes(id),
  }
}

describe('parseCapturedAtMs', () => {
  it('parses ISO strings', () => {
    expect(parseCapturedAtMs('2024-05-01T10:00:00.000Z')).toBe(
      Date.parse('2024-05-01T10:00:00.000Z'),
    )
  })

  it('parses EXIF-style strings with space or T separator', () => {
    const expected = Date.parse('2024-05-01T10:00:00')
    expect(parseCapturedAtMs('2024:05:01 10:00:00')).toBe(expected)
    expect(parseCapturedAtMs('2024:05:01T10:00:00')).toBe(expected)
  })

  it('rejects garbage, undefined and partially matching EXIF strings', () => {
    expect(parseCapturedAtMs('not a date')).toBeNull()
    expect(parseCapturedAtMs(undefined)).toBeNull()
    expect(parseCapturedAtMs('x2024:05:01 10:00:00')).toBeNull()
    expect(parseCapturedAtMs('2024:05:01 10:00:00\nnext')).toBeNull()
    expect(parseCapturedAtMs('2024:05:01 10:00:0')).toBeNull()
  })
})

describe('deriveGalleryView', () => {
  const gallery = ['a', 'b', 'c', 'd']

  it('returns the gallery itself for added order without a filter', () => {
    const view = deriveGalleryView(
      gallery,
      { sort: 'added', unplacedOnly: false },
      source({}),
    )
    expect(view).toBe(gallery)
    expect(
      deriveGalleryView(gallery, { unplacedOnly: false }, source({})),
    ).toBe(gallery)
  })

  it('sorts by name naturally and case-insensitively', () => {
    const names = {
      a: 'IMG_10.jpg',
      b: 'img_2.jpg',
      c: 'Beach.jpg',
      d: 'a.jpg',
    }
    expect(
      deriveGalleryView(
        gallery,
        { sort: 'name', unplacedOnly: false },
        source(names),
      ),
    ).toEqual(['d', 'c', 'b', 'a'])
  })

  it('keeps added order for equal names', () => {
    const names = { a: 'same', b: 'SAME', c: 'same', d: 'aaa' }
    expect(
      deriveGalleryView(
        gallery,
        { sort: 'name', unplacedOnly: false },
        source(names),
      ),
    ).toEqual(['d', 'a', 'b', 'c'])
  })

  it('sorts by capture time ascending with undated photos last in added order', () => {
    const times = { a: 300, b: null, c: 100, d: null }
    expect(
      deriveGalleryView(
        gallery,
        { sort: 'captured', unplacedOnly: false },
        source({}, times),
      ),
    ).toEqual(['c', 'a', 'b', 'd'])
  })

  it('puts an undated photo after a dated one in either input order', () => {
    expect(
      deriveGalleryView(
        ['u', 'd'],
        { sort: 'captured', unplacedOnly: false },
        source({}, { d: 5 }),
      ),
    ).toEqual(['d', 'u'])
    expect(
      deriveGalleryView(
        ['d', 'u'],
        { sort: 'captured', unplacedOnly: false },
        source({}, { d: 5 }),
      ),
    ).toEqual(['d', 'u'])
  })

  it('keeps added order for equal capture times', () => {
    expect(
      deriveGalleryView(
        ['x', 'y', 'z'],
        { sort: 'captured', unplacedOnly: false },
        source({}, { x: 7, y: 7, z: 1 }),
      ),
    ).toEqual(['z', 'x', 'y'])
  })

  it('filters placed photos and composes with sort', () => {
    const names = { a: 'z', b: 'y', c: 'x', d: 'w' }
    expect(
      deriveGalleryView(
        gallery,
        { sort: 'name', unplacedOnly: true },
        source(names, {}, ['a', 'd']),
      ),
    ).toEqual(['c', 'b'])
  })

  it('filters without reordering when sort is added', () => {
    expect(
      deriveGalleryView(
        gallery,
        { sort: 'added', unplacedOnly: true },
        source({}, {}, ['b']),
      ),
    ).toEqual(['a', 'c', 'd'])
  })

  test.prop([
    fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), {
      maxLength: 30,
    }),
    fc.constantFrom('added', 'captured', 'name' as const),
    fc.boolean(),
    fc.array(fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }), {
      maxLength: 30,
    }),
  ])(
    'is a stable permutation of the (filtered) gallery',
    (ids, sortKey, unplacedOnly, rawTimes) => {
      const times = Object.fromEntries(
        ids.map((id, i) => [id, rawTimes[i] ?? null]),
      )
      const placed = ids.filter((_, i) => i % 3 === 0)
      const view = deriveGalleryView(
        ids,
        { sort: sortKey, unplacedOnly },
        source({}, times, placed),
      )
      const expected = unplacedOnly
        ? ids.filter((id) => !placed.includes(id))
        : ids
      expect([...view].sort()).toEqual([...expected].sort())
      if (sortKey === 'captured') {
        for (let i = 1; i < view.length; i += 1) {
          const prev = view[i - 1] ?? ''
          const cur = view[i] ?? ''
          const tp = times[prev] ?? null
          const tc = times[cur] ?? null
          if (tp !== null && tc !== null && tp === tc) {
            expect(ids.indexOf(prev)).toBeLessThan(ids.indexOf(cur))
          }
          if (tp === null) {
            expect(tc).toBeNull()
          }
        }
      }
    },
  )
})

describe('projectOntoView', () => {
  const gallery = ['a', 'b', 'c']

  it('returns the values array itself when the view is the gallery', () => {
    const values = [1, 2, 3]
    expect(projectOntoView(gallery, gallery, values, () => 0)).toBe(values)
  })

  it('re-orders values to follow the view ids', () => {
    expect(projectOntoView(gallery, ['c', 'a'], [10, 20, 30], () => 0)).toEqual(
      [30, 10],
    )
  })

  it('uses the fallback for ids missing from the gallery or values', () => {
    expect(
      projectOntoView(gallery, ['zz', 'b'], [10, 20, 30], (id) => id.length),
    ).toEqual([2, 20])
    expect(projectOntoView(gallery, ['c'], [10], () => -1)).toEqual([-1])
  })
})

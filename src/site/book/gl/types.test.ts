import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { panel } from './testing.test-helpers'
import {
  ENDPAPER,
  PAPER,
  facesOf,
  glBook,
  pageOfFace,
  thickCm,
  viewOfPage,
  viewsOf,
  type GlBookInput,
} from './types'

const input: GlBookInput = {
  cover: { front: panel('f'), spine: panel('s'), back: panel('b') },
  cloth: '#123456',
  pageCount: 10,
  trimMm: { widthMm: 210, heightMm: 297 },
  face: () => Promise.resolve(panel('p')),
}

describe('glBook', () => {
  it('resolves trim to cm and defaults the paper colours', () => {
    const b = glBook(input)

    expect(b).toEqual({
      cover: input.cover,
      cloth: '#123456',
      pages: 10,
      w: 21,
      h: 29.7,
      paper: '#FBFAF7',
      endpaper: '#E9E4DA',
      face: input.face,
    })
    expect([PAPER, ENDPAPER]).toEqual(['#FBFAF7', '#E9E4DA'])
  })

  it('keeps given paper and endpaper colours', () => {
    const b = glBook({ ...input, paper: '#ffffff', endpaper: '#000000' })

    expect([b.paper, b.endpaper]).toEqual(['#ffffff', '#000000'])
  })
})

describe('book counts', () => {
  it('counts faces, views and thickness like the kit', () => {
    const b = { pages: 10 }

    expect(facesOf(b)).toBe(12)
    expect(viewsOf(b)).toBe(8)
    expect(thickCm(b, 100)).toBeCloseTo(1.2)
    expect(thickCm({ pages: 0 }, 10)).toBeCloseTo(1.2)
  })

  it('maps faces to pages with endpapers at both ends', () => {
    const b = { pages: 4 }

    expect(pageOfFace(b, { v: 1, side: 0 })).toBeNull()
    expect(pageOfFace(b, { v: 1, side: 1 })).toBe(0)
    expect(pageOfFace(b, { v: 2, side: 0 })).toBe(1)
    expect(pageOfFace(b, { v: 3, side: 1 })).toBeNull()
    expect(pageOfFace(b, { v: 3, side: 0 })).toBe(3)
    expect(viewOfPage(0)).toBe(1)
    expect(viewOfPage(1)).toBe(2)
    expect(viewOfPage(2)).toBe(2)
  })

  test.prop([fc.integer({ min: 1, max: 200 }), fc.nat(400)])(
    'a page sits on a face of its view',
    (pages, raw) => {
      const page = raw % pages
      const v = viewOfPage(page)
      const sides = ([0, 1] as const).map((side) =>
        pageOfFace({ pages }, { v, side }),
      )

      expect(sides).toContain(page)
      expect(v).toBeLessThan(viewsOf({ pages: pages + (pages % 2) }) - 1)
    },
  )
})

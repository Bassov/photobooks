import { describe, expect, it } from 'vitest'
import { pageShadowRects } from './pageShadowModel'

describe('pageShadowRects', () => {
  it('stacks mounted spreads by stride and centres each in the world width', () => {
    // Arrange: slots 1..3 of a 4-spread book (single first and last page).
    const input = {
      mounted: ['b', 'c', 'd'],
      start: 1,
      spreadCount: 4,
      stride: 660,
      spreadHeightPx: 588,
      pageWidthPx: 400,
      worldWidthPx: 800,
    }

    // Act
    const rects = pageShadowRects(input)

    // Assert
    expect(rects).toEqual([
      { spreadId: 'b', u: 0, v: 660, w: 800, h: 588 },
      { spreadId: 'c', u: 0, v: 1320, w: 800, h: 588 },
      { spreadId: 'd', u: 200, v: 1980, w: 400, h: 588 },
    ])
  })

  it('gives the cover spread a single centred page', () => {
    const [cover] = pageShadowRects({
      mounted: ['a'],
      start: 0,
      spreadCount: 3,
      stride: 100,
      spreadHeightPx: 80,
      pageWidthPx: 60,
      worldWidthPx: 120,
    })

    expect(cover).toEqual({ spreadId: 'a', u: 30, v: 0, w: 60, h: 80 })
  })
})

import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { pagesOf } from '../core/pages'
import {
  hashForSlide,
  slideCount,
  slideForHash,
  slideLabel,
  stageWidth,
} from './siteModel'

const RUNS = { numRuns: 1000 }

const spreads = fc.integer({ min: 1, max: 60 })

describe('siteModel properties', () => {
  test.prop([spreads.chain((n) => fc.tuple(fc.constant(n), fc.nat(n)))], RUNS)(
    'every slide survives the hash round trip',
    ([n, slide]) => {
      expect(slideForHash(hashForSlide(slide, n), n)).toBe(slide)
    },
  )

  test.prop(
    [
      spreads.chain((n) =>
        fc.tuple(
          fc.constant(n),
          fc.integer({ min: 1, max: Math.max(1, pagesOf(n)) }),
        ),
      ),
    ],
    RUNS,
  )('any page opens the spread whose label holds it', ([n, page]) => {
    const slide = slideForHash(`#p${String(page)}`, n)

    expect(slide).toBeGreaterThanOrEqual(1)
    expect(slide).toBeLessThan(slideCount(n))
    const label = slideLabel(slide, n).split(' · ')[0] ?? ''
    const [first, last = first] = label.replace(/^Pages? /, '').split('–')
    expect(page).toBeGreaterThanOrEqual(Number(first))
    expect(page).toBeLessThanOrEqual(Number(last))
  })

  test.prop(
    [
      fc.integer({ min: 200, max: 4000 }),
      fc.integer({ min: 300, max: 3000 }),
      fc.double({ min: 0.5, max: 4, noNaN: true }),
    ],
    RUNS,
  )(
    'the stage fits the content; it is 280 or more when the content is',
    (vw, vh, ratio) => {
      const content = vw - 2 * (vw < 768 ? 20 : 32)
      const w = stageWidth({ vw, vh, ratio })

      expect(w).toBeLessThanOrEqual(Math.min(760, content))
      expect(w).toBeGreaterThanOrEqual(Math.min(280, content))
    },
  )
})

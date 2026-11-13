import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { pagesOf } from '../core/pages'
import { hashForSlide, slideForHash, viewLabel } from './siteModel'

const RUNS = { numRuns: 1000 }

const spreads = fc.integer({ min: 1, max: 60 })

describe('siteModel properties', () => {
  test.prop([spreads.chain((n) => fc.tuple(fc.constant(n), fc.nat(n)))], RUNS)(
    'every spread view and the cover survive the hash round trip',
    ([n, view]) => {
      expect(slideForHash(hashForSlide(view, n), n)).toBe(view)
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
  )('any page opens the view whose label holds it', ([n, page]) => {
    const view = slideForHash(`#p${String(page)}`, n)

    expect(view).toBeGreaterThanOrEqual(1)
    expect(view).toBeLessThanOrEqual(n)
    const label = viewLabel(view, n).replace(/ of \d+$/, '')
    const [first, last = first] = label.replace(/^Pages? /, '').split('–')
    expect(page).toBeGreaterThanOrEqual(Number(first))
    expect(page).toBeLessThanOrEqual(Number(last))
  })
})

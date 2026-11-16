import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { bucketNameFor } from './provision'
import { BUCKET_PATTERN } from './r2Sign'

const PBT_RUNS = { numRuns: 500 }

describe('bucketNameFor (PBT)', () => {
  test.prop([fc.oneof(fc.domain(), fc.string(), fc.webSegment())], PBT_RUNS)(
    'is always a valid R2 bucket name of at most 63, the same each time',
    (host) => {
      const name = bucketNameFor(host)

      expect(BUCKET_PATTERN.test(name)).toBe(true)
      expect(name.length).toBeLessThanOrEqual(63)
      expect(name.startsWith('pb-')).toBe(true)
      expect(bucketNameFor(host)).toBe(name)
    },
  )

  test.prop([fc.domain({ size: 'small' })], PBT_RUNS)(
    'is pb- and the lowercased host with dots as hyphens when it fits',
    (host) => {
      fc.pre(host.length <= 60)

      expect(bucketNameFor(host)).toBe(
        `pb-${host.toLowerCase().split('.').join('-')}`,
      )
    },
  )
})

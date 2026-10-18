import { describe, expect, it } from 'vitest'
import { markE2eCoverageProbe } from './e2eCoverageProbe'

describe('e2eCoverageProbe', () => {
  it('exports a function (body left uncalled for NoCoverage proof)', () => {
    expect(typeof markE2eCoverageProbe).toBe('function')
  })
})

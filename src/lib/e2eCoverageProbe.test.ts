import { describe, expect, it } from 'vitest'
import { E2E_COVERAGE_PROBE_MARKER } from './e2eCoverageProbe'

describe('e2eCoverageProbe', () => {
  it('loads the module marker without calling markE2eCoverageProbe', () => {
    expect(E2E_COVERAGE_PROBE_MARKER).toBe('e2e-coverage-probe-marker')
  })
})

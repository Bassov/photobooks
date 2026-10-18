/** Scratch-only probe for e2e-coverage-flag Done-when (delete with scratch branch). */
export const E2E_COVERAGE_PROBE_MARKER = 'e2e-coverage-probe-marker'

export function markE2eCoverageProbe(): string {
  return 'e2e-coverage-probe-v1'
}

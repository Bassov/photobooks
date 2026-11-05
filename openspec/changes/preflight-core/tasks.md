## Implementation

- [x] 1. `src/core/print/preflight.ts`: rule / fix-action const unions, rule table (severity + fix), issue shape, `preflight()` over resolved spreads (DPI, safe zone, bleed hazard, empty frames, missing / modified assets, page count); export from `src/core/index.ts`. Evidence: `src/core/print/preflight.ts`, `src/core/index.ts`.
- [x] 2. `src/core/print/preflight.test.ts`: one triggering and one clean fixture per rule, snapshot of the rule table, 100-spread timing (< 5 ms). Evidence: 28 tests green; stryker:diff 98.65 %, 0 NoCoverage.
- [x] 3. `src/core/print/preflight.pbt.test.ts`: a generated clean book yields `[]` (numRuns ≤ 100). Evidence: 50 runs, ~0.3 s.

## Manual test scenarios

N/A (pure module, no UI).

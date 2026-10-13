# Proposal

## Problem

Unit coverage floors sit at ~43% (no-regression snapshot). Large product surface (`useOpenPhoto`, LoAF/perf hooks, `PhotoCard`/`App`, photo worker pipeline, `exifSchema`) is untested under Vitest, so the gate does not protect new decode/UI/orchestration code.

## Why now

Product surface is still small enough to bring under an 80% hard gate before more modules land; raising later will be costlier.

## Scope in

- Raise Vitest + Codecov floors to **80%** (statements, branches, functions, lines)
- Exclude only benches and `.d.ts` from coverage; **include** `photo.worker` (via extractable public API)
- Unit tests for UI/orchestration, perf hooks, schema, worker processing, and remaining domain gaps
- Update `ci-gates` delta; Stryker mutate list for new process module

## Scope out

- 90% floors (follow-up)
- Counting Playwright toward Vitest coverage
- Product UX/feature changes beyond testability seams

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: coverage threshold floor raised to 80%; coverage include/exclude rules clarified

## Success criteria

- `pnpm test:coverage` passes with thresholds ≥80% on all four metrics
- Worker processing logic covered via public API (not excluded from denominator)
- Codecov project target 80%; patch remains informational
- UI shows Open photo / card / error paths under unit tests (observable DOM)

## Risks

- **Security:** worker/`postMessage` and blob preview URLs stay in scope for tests — do not weaken CSP or transfer trust boundaries; mock only I/O edges
- Worker/canvas/bitmap mocks can drift from real browsers — fixtures + boundary mocks only
- Thin worker shell may stay lightly covered; processing module must carry the gate weight

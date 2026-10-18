# Proposal

## Why

**Problem:** Blocking `codecov/patch` (85%) sees only the `unit` flag, so editor paths covered solely by Playwright stay red on patch.
**Why now:** M2.1 needs e2e lines in the merged patch denominator before later ratchet work.

## What Changes

- **In:** Exact-pinned Istanbul + coverage merge deps; instrument the Playwright preview build only (`VITE_COVERAGE=1`). Production, preview, and LHCI builds stay uninstrumented. Excludes match the existing coverage registry; reports map back to `src/**`.
- **In:** Every e2e spec contributes browser coverage; CI merges it and uploads Codecov flag `e2e` with `fail_ci_if_error`. `codecov.yml` carries the e2e flag forward and waits for both unit and e2e builds before notify. Owner decision: e2e lines count toward blocking `codecov/patch`; a unit-only patch status stays informational only.
- **In:** `ci-gates` delta — e2e flag upload + multi-flag patch; Stryker stays Vitest-only; NoCoverage still requires unit tests (e2e never substitutes for mutation).
- **Out:** Changing Vitest floors / `quality/gates.json` gate values; instrumenting production/preview/LHCI; counting workers in e2e; replacing unit tests with e2e for mutation; editing `openspec/config.yaml`, `.cursor/*`, `AGENTS.md`, `scripts/agent.mjs` (parallel `agent-cost-cuts`).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: e2e coverage flag upload and merged multi-flag `codecov/patch`; e2e must not satisfy mutation / NoCoverage via Playwright alone.

## Impact

- Tooling/CI and OpenSpec `ci-gates` only; no product behavior change.
- New deps: `pnpm audit:ci` + Security Review before archive.
- Success (Done when, proven on this PR’s CI head): Codecov comment shows `unit` and `e2e`; an e2e-only line counts for `codecov/patch`; failed e2e upload fails `integration`; e2e-only coverage still yields NoCoverage in `stryker-diff`.
- Risks: **Security** — new pinned deps expand the supply chain (mitigate with `audit:ci` + Security Review). Instrumentation must not leak into non-e2e builds. Waiting for both uploads must not leave patch pending when one upload fails.

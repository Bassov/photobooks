# Proposal

## Problem

PR #15 adds Codecov Test Analytics and Components, but Bundle Analysis is still missing — CI already builds the Vite app without reporting size regressions to Codecov.

## Why now

Same Codecov integration wave (#7); token/App ready; LHCI covers Lighthouse budgets but not PR-visible JS bundle deltas in Codecov.

## Scope in

- `@codecov/vite-plugin` on Vite builds (enabled when `CODECOV_TOKEN` is set)
- Pass token into checks `pnpm build` so CI uploads bundle stats
- Codecov YAML: informational bundle status (no hard fail); keep existing coverage comment behavior
- Delta to `ci-gates`

## Scope out

- Failing the PR on bundle growth (informational only for now)
- Replacing LHCI / `budget.json`
- Multiple named bundles beyond the app build

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: require Codecov Bundle Analysis upload from the CI Vite build

## Success criteria

- CI `pnpm build` with token uploads bundle analysis to Codecov
- Local builds without token skip upload
- Codecov PR/commit surfaces show bundle info (informational status)

## Risks

- **Security:** reuses `CODECOV_TOKEN` in build env — do not log the secret; plugin only uploads when token present
- Bundle upload noise / flaky plugin network — keep status informational so merge is not blocked

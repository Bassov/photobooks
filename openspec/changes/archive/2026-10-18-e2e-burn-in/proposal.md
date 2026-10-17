## Problem

PR e2e still hides flakes behind retries (`retries: 2` in CI). New or touched e2e paths can merge green while failing intermittently under load.

## Why now

M2.1 phase 1 needs a burn-in gate before `strict-e2e` drops retries. Without it, flake fixes stay anecdotal and later zero-retry PRs would only fail after the fact.

## Scope

- **In:** On PRs, `integration` burns in added/changed `e2e/**/*.spec.ts` and specs that import changed `e2e/helpers/**` with `--repeat-each` (default 10 via `E2E_BURN_IN`), `--retries=0`, `--workers=1`. Roadmap item files may declare `Burn-in: 50` for flake-fix items. Main e2e keeps current retries for now. CI report surfaces burn-in run count and main-run retried-pass (“flaky”) count.
- **Out:** Moving the repeat count into `quality/gates.json` / ratchet (`gate-values-file`); zeroing PR retries / `@flaky` list (`strict-e2e`); fixing known flakes (`e2e-local-flakes`, `e2e-frame-budget-flakes`).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: PR integration MUST burn in changed e2e specs/helpers; CI report MUST surface burn-in and main-run flaky-retry counts.

## Success criteria

- Changed e2e specs (and helper-importers) run burn-in with retries off and workers=1; default repeat is 10 from `E2E_BURN_IN`.
- A deliberately timing-dependent fixture fails burn-in under that policy.
- Declaring `Burn-in: 50` on an item causes CI to use 50 repeats for that run.
- CI report lists burn-in count and main-run flaky (retried-pass) count.

## Risks

- Large e2e diffs can lengthen `integration` wall time — mitigate by scoping only changed specs/helpers and serial workers.
- Missed helper-importer detection could skip burn-in — cover selector logic with unit tests.

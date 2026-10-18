# e2e-coverage-flag

Tag: prep
Milestone: M2.1
Title: e2e counts toward coverage and codecov/patch (issue #72 A, #29)
Status: done

## Scope

- [x] `vite-plugin-istanbul` and `nyc` (exact-pinned; until `docs/backlog/dependency-policy.md` is re-added, new deps need `audit:ci` + Security Review), gated on `VITE_COVERAGE=1`, set only by the Playwright `webServer` build. Excludes come from the registry. Production, preview and LHCI builds stay uninstrumented. Source maps map back to `src/**`
- [x] `e2e/fixtures/coverage.ts` (`test.extend`) that every spec imports. It writes `window.__coverage__` per test. Merge with `nyc` into `coverage-e2e/lcov.info`. Worker code is not counted by e2e
- [x] `integration.yml` uploads with `flags: e2e` and `fail_ci_if_error`. `codecov.yml` gets `flags.e2e` (`carryforward: false`) and `codecov.notify.after_n_builds: 2`. **Owner decision:** e2e lines count toward the blocking `codecov/patch`; a unit-only patch status is informational only
- [x] e2e never replaces unit tests for mutation: Stryker runs Vitest only, and `stryker-diff-gate` NoCoverage still requires unit tests. `ci-gates` spec delta says both
- **Done when:** the Codecov API reports `unit` and `e2e` flags separately with distinct coverage on the head (proven on scratch PR #112: probe line unit miss / e2e hit), a line covered only by e2e counts for `codecov/patch`, a failed e2e upload fails `integration`, and a line covered only by e2e still produces a NoCoverage mutant in `stryker-diff`.
- **Owner decision 2026-10-19:** the original clause "the Codecov PR comment shows `unit` and `e2e` separately" is narrowed to the Codecov API, because Codecov does not render the Flags table in PR comments on this repo (verified on #110 and #112). The PR-comment Flags table moved to `docs/backlog/codecov-pr-comment-flags.md`.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 A, #29

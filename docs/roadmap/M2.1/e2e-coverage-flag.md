# e2e-coverage-flag

Tag: prep
Milestone: M2.1
Title: e2e counts toward coverage (issue #72 A)

## Scope

- [ ] `vite-plugin-istanbul` and `nyc` (exact-pinned through `dependency-policy`), gated on `VITE_COVERAGE=1`, set only by the Playwright `webServer` build. Excludes come from the registry. Production, preview and LHCI builds stay uninstrumented. Source maps map back to `src/**`
- [ ] `e2e/fixtures/coverage.ts` (`test.extend`) that every spec imports. It writes `window.__coverage__` per test. Merge with `nyc` into `coverage-e2e/lcov.info`. Worker code is not counted by e2e
- [ ] `integration.yml` uploads with `flags: e2e` and `fail_ci_if_error`. `codecov.yml` gets `flags.e2e` (`carryforward: true`) and `notify.after_n_builds: 2`, plus an informational unit-only patch status
- [ ] `ci-gates` spec delta: the `e2e` flag. e2e coverage never replaces unit tests (Stryker runs Vitest only)
- **Done when:** the Codecov comment shows `unit` and `e2e` separately, a line covered only by e2e counts for `codecov/patch`, and a failed e2e upload fails `integration`.

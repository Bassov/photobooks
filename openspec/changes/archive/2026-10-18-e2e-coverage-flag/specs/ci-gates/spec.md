# Spec Delta

## MODIFIED Requirements

### Requirement: Coverage thresholds and Codecov

Unit test coverage SHALL enforce an **80%** floor in CI (statements, branches, functions, lines), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available. Project Codecov configuration SHALL set a blocking patch status at **85%** target with **0%** threshold (final; no planned raise). The blocking patch status SHALL evaluate the merged coverage of every uploaded flag (`unit` and `e2e`); an informational unit-only status MUST NOT replace the blocking patch check. Codecov SHALL wait for two coverage uploads per commit (`codecov.notify.after_n_builds: 2`) covering the `unit` and `e2e` flags before notifying, so `codecov/patch` is not finalized after the unit upload alone. The `e2e` flag MUST NOT carry forward (a prior commit must not satisfy `after_n_builds` without a fresh e2e upload). Enforced GitHub check from this change: `codecov/patch` only. Project no-drop status (`auto` / 0.5% plus 80% floor) and the expanded Components table are moved to backlog `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18; Codecov does not post those on this repo). YAML MAY retain matching `project.*` and `component_management` keys as valid harmless config without claiming they are enforced checks.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (blocking patch 85%, PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

#### Scenario: Patch under target fails codecov/patch

- **WHEN** a pull request's merged uploaded-flag patch coverage is below 85%
- **THEN** Codecov reports a failing `codecov/patch` status

#### Scenario: E2e-only line counts toward patch

- **WHEN** a changed line is covered by the `e2e` flag upload and not by the `unit` flag
- **THEN** that line counts as covered for the blocking `codecov/patch` evaluation

#### Scenario: Flags appear separately in the Codecov comment

- **WHEN** both `unit` and `e2e` coverage uploads succeed for a pull request
- **THEN** the Codecov pull-request comment shows `unit` and `e2e` as separate flags

## ADDED Requirements

### Requirement: E2E coverage instrumentation and upload

The Playwright e2e suite SHALL collect Istanbul coverage for `src/**` using the shared Vitest coverage exclude set, gated on `VITE_COVERAGE=1` for the Playwright `webServer` build only. Every e2e spec SHALL persist browser coverage via the shared fixture and merge it to lcov. The integration workflow SHALL upload that report to Codecov with `flags: e2e` and `fail_ci_if_error` when a token is available.

#### Scenario: Playwright build is instrumented

- **WHEN** Playwright starts its `webServer` with `E2E_COVERAGE=1` (which sets `VITE_COVERAGE=1` on that build only)
- **THEN** the served app exposes Istanbul `window.__coverage__` for included `src/**` modules

#### Scenario: Non-e2e builds stay clean

- **WHEN** a production, preview, or Lighthouse CI build runs without `VITE_COVERAGE=1`
- **THEN** the build output is not Istanbul-instrumented

#### Scenario: Specs persist and merge coverage

- **WHEN** the main e2e suite finishes
- **THEN** per-test coverage dumps are merged into `coverage-e2e/lcov.info` mapped back to `src/**`

#### Scenario: Failed e2e upload fails integration

- **WHEN** the integration workflow's Codecov e2e upload fails while a Codecov token is configured
- **THEN** the integration workflow fails

#### Scenario: Workers excluded from e2e coverage

- **WHEN** e2e coverage is collected
- **THEN** worker entry modules under `src/` do not appear as covered lines in the e2e report

### Requirement: Mutation stays unit-only despite e2e coverage

Diff and full mutation runs SHALL continue to execute only Vitest (not Playwright). A line covered solely by e2e SHALL still be reported as NoCoverage by `stryker-diff` when no unit test covers it. E2e coverage MUST NOT be treated as satisfying mutation or NoCoverage requirements.

#### Scenario: Stryker runner remains Vitest

- **WHEN** `stryker-diff` or full Stryker runs
- **THEN** the configured test runner is Vitest and Playwright is not invoked

#### Scenario: E2e-only coverage yields NoCoverage

- **WHEN** a mutated line is covered only by e2e and not by any unit test
- **THEN** `stryker-diff` reports that mutant as NoCoverage

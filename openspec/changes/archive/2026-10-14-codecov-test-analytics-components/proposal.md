# Proposal

## Problem

Codecov already receives unit coverage uploads and PR comments, but the repo does not use Test Analytics (failed/flaky tests) or Components (per-module coverage groups). Issue #7 asks to wire the remaining useful Codecov features.

## Why now

Token and GitHub App are already connected; only repo config/CI is missing. Module map (`photo/`, `perf/`, `lib/`) is stable enough to define components before more surface lands.

## Scope in

- Vitest JUnit report + upload to Codecov Test Analytics from checks (even when tests fail)
- Codecov Components for `photo`, `perf`, and `lib` with PR comment visibility
- Delta updates to `ci-gates`

## Scope out

- Bundle Analysis (separate change)
- Patch coverage as a hard gate (stays informational)
- Playwright / e2e coverage flags
- Replacing the existing sticky coverage PR comment

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: require Codecov Test Analytics upload and Components config for module paths

## Success criteria

- Checks upload JUnit test results to Codecov when the unit-test step runs (including failures / cancelled-safe upload)
- `codecov.yml` defines components for `src/photo`, `src/perf`, `src/lib` and includes them in the PR comment layout
- Existing coverage upload, 80% floors, and sticky coverage comment remain unchanged in behavior

## Risks

- Duplicate PR noise (Codecov comment + sticky coverage + Test Analytics sections) — keep sticky as-is; tune Codecov layout only
- JUnit path / reporter misconfig can silently skip Test Analytics — pin output path and ensure upload still runs after failed or cancelled unit tests

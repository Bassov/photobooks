# Proposal

## Why

Patch coverage is informational, so PRs can merge without covering new lines. M2.1 phase 2 needs a blocking patch gate before later ratchet items.

## What Changes

- **In:** `codecov.yml` — blocking `patch.default` at 85% / 0% threshold; retain `project.*` and expanded Components keys as valid harmless config (enforcement of project status / components table deferred to backlog).
- **In:** `ci-gates` delta — document final blocking patch 85% and the rule that every uploaded flag (unit now; `e2e` after `e2e-coverage-flag`) counts toward `codecov/patch` (no informational unit-only replacement); note project/components moved to backlog.
- **In:** `INTRO.md` owner-setup note — record that `codecov/patch` must be a required check on `main` (owner action; agents do not change branch protection).
- **In:** `docs/backlog/codecov-project-components.md` — deferred `codecov/project` no-drop and components table (owner decision 2026-10-18).
- **Out:** Vitest floor changes; exclusions / ignore list; e2e coverage upload (later item); repo settings / required-check edits by the agent; `test-fake` un-counting (moved to `exclusions-registry`); requiring `codecov/project` (never posted here).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: Coverage thresholds and Codecov — blocking patch 85%, multi-flag patch rule; project/components enforcement deferred to backlog.

## Impact

- Config/docs: `codecov.yml`, `docs/roadmap/M2.1/INTRO.md`, backlog file, OpenSpec `ci-gates` delta.
- No app code, no new dependencies, no CI workflow job moves.
- Success: Codecov validates config; blocking `codecov/patch` at 85% is red on scratch #105 and green on #104.
- Risks: owner must add `codecov/patch` on `main` or GitHub will not enforce it; red-path proof used a short-lived scratch PR.

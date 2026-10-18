# Proposal

## Why

Patch coverage is informational and project coverage can drop by a full percent before failing, so PRs can merge without covering new lines. M2.1 phase 2 needs a blocking patch gate and a no-drop project policy before later ratchet items.

## What Changes

- **In:** `codecov.yml` — blocking `patch.default` at 85% / 0% threshold; `project.default` `target: auto` / `threshold: 0.5%`; keep an 80% project floor status; add Components `editor`, `project`, `assets`, `render`, `core`, `scripts` beside existing ones.
- **In:** `ci-gates` delta — document final patch 85%, components, and the rule that every uploaded flag (unit now; `e2e` after `e2e-coverage-flag`) counts toward `codecov/patch` (no informational unit-only replacement).
- **In:** `INTRO.md` owner-setup note — record that `codecov/patch` and `codecov/project` must be required checks on `main` (owner action; agents do not change branch protection).
- **Out:** Vitest floor changes; exclusions / ignore list; e2e coverage upload (later item); repo settings / required-check edits by the agent; `test-fake` un-counting (moved to `exclusions-registry`).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: Coverage thresholds and Codecov — blocking patch 85%, project auto/0.5% plus 80% floor, expanded Components, multi-flag patch rule.

## Impact

- Config: `codecov.yml`, `docs/roadmap/M2.1/INTRO.md`, OpenSpec `ci-gates` delta only.
- No app code, no new dependencies, no CI workflow job moves.
- Success: Codecov validates config; a PR under 85% patch gets red `codecov/patch`; a PR dropping project coverage >0.5% gets red `codecov/project`; Codecov comment lists `editor`, `project`, `assets`, `scripts` (and the other new components).
- Risks: owner must add required checks on `main` or GitHub will not enforce Codecov statuses; red-path proof may need a short-lived scratch PR that is closed and deleted afterward.

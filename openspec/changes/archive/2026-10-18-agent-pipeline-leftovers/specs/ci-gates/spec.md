## ADDED Requirements

### Requirement: Checks job uses unified check without weakening

The required CI `checks` job SHALL invoke `pnpm check` for the shared deterministic inventory that local pre-push uses. Every gate that job previously ran as a failing step (including format check, coverage, build, dist-header assert, and production audit) MUST still run in that same required job and MUST fail the job when it fails. The change MUST NOT move those gates to a non-required job or mark them `continue-on-error`.

#### Scenario: Shared inventory via pnpm check

- **WHEN** a pull request runs the checks workflow
- **THEN** the required `checks` job runs `pnpm check` (verbose in CI logs) for the shared local inventory

#### Scenario: Prior required steps still fail the job

- **WHEN** format check, coverage, build, dist-header assert, or production audit fails
- **THEN** the same required `checks` job fails and the failing step is not `continue-on-error`

## MODIFIED Requirements

### Requirement: Dead-code and unused-dependency gate

Local `pnpm check` (and the checks workflow) SHALL fail when knip reports unused exports, unused files, or unused dependencies per the committed knip configuration.

#### Scenario: Knip fails verify:fast

- **WHEN** an unused production export or unused dependency is introduced that knip is configured to detect
- **THEN** `pnpm knip` (as part of `pnpm check`) exits non-zero

#### Scenario: Knip in CI checks

- **WHEN** a pull request or push to the default branch runs the checks workflow
- **THEN** the workflow executes knip via `pnpm check` (or an equivalent step in the same required job) and fails if knip reports configured violations

### Requirement: Layer-boundary dependency cruise

Local `pnpm check` (and the checks workflow) SHALL fail when dependency-cruiser reports a forbidden import per the committed rules (at minimum: `src/lib` MUST NOT import React or photo/UI app modules; listed pure `src/photo` helpers MUST NOT import React).

#### Scenario: Forbidden import fails deps

- **WHEN** `src/lib` imports `react` or a `src/photo` / App UI module in violation of committed rules
- **THEN** `pnpm deps` (as part of `pnpm check`) exits non-zero

#### Scenario: Deps in CI checks

- **WHEN** a pull request or push to the default branch runs the checks workflow
- **THEN** the workflow executes deps via `pnpm check` (or an equivalent step in the same required job) and fails if dependency-cruiser reports a forbidden violation

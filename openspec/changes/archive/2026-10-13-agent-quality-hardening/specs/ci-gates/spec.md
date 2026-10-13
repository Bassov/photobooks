## ADDED Requirements

### Requirement: Dead-code and unused-dependency gate

Local `verify:fast` and the checks workflow SHALL fail when knip reports unused exports, unused files, or unused dependencies per the committed knip configuration.

#### Scenario: Knip fails verify:fast

- **WHEN** an unused production export or unused dependency is introduced that knip is configured to detect
- **THEN** `pnpm knip` (as part of `pnpm verify:fast`) exits non-zero

#### Scenario: Knip in CI checks

- **WHEN** a pull request or push to the default branch runs the checks workflow
- **THEN** the workflow executes `pnpm knip` and fails if knip reports configured violations

### Requirement: Layer-boundary dependency cruise

Local `verify:fast` and the checks workflow SHALL fail when dependency-cruiser reports a forbidden import per the committed rules (at minimum: `src/lib` MUST NOT import React or photo/UI app modules; listed pure `src/photo` helpers MUST NOT import React).

#### Scenario: Forbidden import fails deps

- **WHEN** `src/lib` imports `react` or a `src/photo` / App UI module in violation of committed rules
- **THEN** `pnpm deps` (as part of `pnpm verify:fast`) exits non-zero

#### Scenario: Deps in CI checks

- **WHEN** a pull request or push to the default branch runs the checks workflow
- **THEN** the workflow executes `pnpm deps` and fails if dependency-cruiser reports a forbidden violation

### Requirement: Stricter TypeScript indexed access and zero ESLint warnings

Application TypeScript configs SHALL enable `noUncheckedIndexedAccess`. The lint script SHALL run ESLint with `--max-warnings=0` so warnings fail the gate.

#### Scenario: Indexed access is checked

- **WHEN** `pnpm typecheck` runs
- **THEN** TypeScript enforces `noUncheckedIndexedAccess` for application sources

#### Scenario: ESLint warnings fail lint

- **WHEN** ESLint emits any warning
- **THEN** `pnpm lint` exits non-zero

# ci-gates Specification

## Purpose

Defines CI quality and security gates for Photobooks on the public GitHub repository, including PR-visible coverage and mutation reporting, without replacing existing `audit:ci` or CodeQL.

## Requirements

### Requirement: Format check in CI

The checks workflow SHALL fail when the repository fails Prettier check (`format:check`).

#### Scenario: Format drift blocks checks

- **WHEN** a pull request or push to the default branch runs the checks workflow
- **THEN** the workflow executes format check and fails if formatting does not match Prettier

### Requirement: Coverage thresholds and Codecov

Unit test coverage SHALL enforce a no-regression floor in CI, and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if measured coverage is below the configured Vitest thresholds

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

### Requirement: Dependabot dependency updates

The repository SHALL declare Dependabot configuration for npm and GitHub Actions on a weekly schedule.

#### Scenario: Dependabot ecosystems configured

- **WHEN** Dependabot runs against the repository
- **THEN** it can open update PRs for npm and GitHub Actions dependencies per the committed Dependabot config

### Requirement: Dependency review on pull requests

Pull requests SHALL run GitHub Dependency Review so vulnerable or disallowed dependency changes in the lockfile diff can fail the PR.

#### Scenario: Lockfile vulnerability on PR

- **WHEN** a pull request changes dependencies in a way Dependency Review flags
- **THEN** the dependency-review workflow fails for that pull request

### Requirement: Existing audit and CodeQL remain

CI SHALL continue to run `pnpm audit:ci` in checks and CodeQL for JavaScript/TypeScript on pull requests and the default branch. New dependency gates MUST NOT replace those controls.

#### Scenario: Audit still in checks

- **WHEN** the checks workflow runs
- **THEN** it still executes `pnpm audit:ci`

#### Scenario: CodeQL still on PR

- **WHEN** a pull request targets the default branch
- **THEN** CodeQL analysis for JavaScript/TypeScript still runs

### Requirement: Secret lint in CI

CI SHALL run a secret-scanning linter on pull requests and pushes to the default branch.

#### Scenario: Secret detected

- **WHEN** a pull request or default-branch push introduces a high-entropy secret that the linter detects
- **THEN** the secret-lint workflow fails

### Requirement: Lighthouse on default-branch push

Lighthouse CI budgets SHALL run on push to the default branch as well as on pull requests.

#### Scenario: LHCI on main push

- **WHEN** a push lands on the default branch
- **THEN** the Lighthouse CI workflow runs

### Requirement: Lighthouse reporting on pull requests

The Lighthouse CI job on a pull request SHALL publish a sticky pull-request comment with category scores and a link to the HTML report when LHCI output is available.

#### Scenario: Lighthouse sticky comment

- **WHEN** the Lighthouse workflow finishes on a pull request
- **THEN** it upserts a sticky pull-request comment with scores and report link(s)

### Requirement: Mutation reporting on pull requests

The pull-request mutation job SHALL publish a PR-visible mutation summary and a downloadable HTML mutation report, and SHALL write a job Step Summary with the mutation score.

#### Scenario: Mutation sticky comment and artifact

- **WHEN** the pull-request mutation workflow completes (success or failure after a report is produced)
- **THEN** it uploads the HTML mutation report as an artifact and upserts a sticky pull-request comment with the mutation score summary

#### Scenario: Mutation Step Summary

- **WHEN** the pull-request mutation workflow produces a mutation report
- **THEN** the job Step Summary includes the mutation score and killed/survived counts

### Requirement: Coverage Step Summary

The checks workflow SHALL write a compact coverage summary to the job Step Summary after coverage runs, and on pull requests SHALL upsert a sticky comment with the same totals when a coverage summary file is available.

#### Scenario: Coverage visible in Actions Summary

- **WHEN** the checks workflow finishes the coverage step
- **THEN** the job Step Summary includes coverage totals

#### Scenario: Coverage sticky comment on pull request

- **WHEN** the checks workflow produces coverage summary JSON on a pull request
- **THEN** it upserts a sticky pull-request comment with coverage totals

### Requirement: Operator documentation for secrets

Project navigation or README documentation SHALL state that a Codecov token repository secret is required for reliable Codecov PR comments and that GitHub secret scanning / push protection should be enabled in repository settings.

#### Scenario: Docs mention Codecov token and scanning

- **WHEN** an operator reads AGENTS.md or README CI notes
- **THEN** they can find guidance for `CODECOV_TOKEN` and enabling GitHub secret scanning / push protection

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

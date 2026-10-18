# Spec Delta

## ADDED Requirements

### Requirement: Central gate values file

Non-Codecov CI gate thresholds and gate lists SHALL live in `quality/gates.json`. Tool configs and loaders that apply those values MUST read them from that file (or a shared loader) and MUST NOT hardcode them. Committed `budget.json` and `e2e/flaky.json` mirrors, when present, MUST deep-equal the matching fields in that file.

#### Scenario: Coverage floors come from gates file

- **WHEN** Vitest coverage thresholds are configured
- **THEN** statements, branches, functions, and lines floors are taken from `quality/gates.json` and match the previously committed floors

#### Scenario: Mutation thresholds come from gates file

- **WHEN** Stryker thresholds are configured
- **THEN** high, low, and break values are taken from `quality/gates.json` and match the previously committed thresholds

#### Scenario: Lighthouse gates come from gates file

- **WHEN** Lighthouse CI collect/assert settings and resource budgets are configured
- **THEN** run count, assertion levels, and budget limits are taken from `quality/gates.json` (with `budget.json` deep-equal when that mirror exists)

#### Scenario: Playwright retries come from gates file

- **WHEN** Playwright CI retry policy is configured
- **THEN** main-suite and `@flaky` project retry counts are taken from `quality/gates.json` and match the previously committed counts

#### Scenario: Burn-in default and flaky list come from gates file

- **WHEN** the effective burn-in default or the `@flaky` list is resolved without an overriding env/roadmap value
- **THEN** the default repeat count and the flaky spec list are taken from `quality/gates.json` (with `e2e/flaky.json` deep-equal when that mirror exists)

### Requirement: Gate values static check

Local `pnpm check` (and the checks workflow) SHALL run a static check that does not evaluate Vite, Stryker, Lighthouse, or Playwright configs as programs. That check MUST fail when a listed gate consumer hardcodes an in-scope gate value instead of reading `quality/gates.json`, or when a committed `budget.json` / `e2e/flaky.json` mirror is not deep-equal to the corresponding `quality/gates.json` field.

#### Scenario: Hardcoded threshold fails check

- **WHEN** a listed gate consumer contains a hardcoded in-scope gate threshold or flaky list instead of reading `quality/gates.json`
- **THEN** `pnpm check` fails

#### Scenario: Diverged budget mirror fails check

- **WHEN** committed `budget.json` is not deep-equal to the budgets field in `quality/gates.json`
- **THEN** `pnpm check` fails

#### Scenario: Diverged flaky mirror fails check

- **WHEN** committed `e2e/flaky.json` is not deep-equal to the flaky list field in `quality/gates.json`
- **THEN** `pnpm check` fails

## MODIFIED Requirements

### Requirement: Flaky e2e list and job

The repository SHALL maintain the `@flaky` spec list in `quality/gates.json` (mirrored by `e2e/flaky.json` when that file is committed) as a JSON array of repo-relative Playwright spec paths that run only in a dedicated `@flaky` CI job (retries allowed). The main e2e suite MUST exclude those paths. `integration` MUST fail when a non-skipped `@flaky` job fails, and MUST accept a skipped job when the list is empty. The list MAY only shrink later via `quality/gates.json`.

#### Scenario: Empty flaky list skips job

- **WHEN** the `@flaky` list in `quality/gates.json` (and `e2e/flaky.json` when present) is an empty list on a pull request
- **THEN** the `@flaky` job is skipped and `integration` still requires main e2e (and burn-in on pull requests) to succeed

#### Scenario: Non-empty flaky list is gated

- **WHEN** the `@flaky` list lists one or more specs on a pull request
- **THEN** those specs run only in the `@flaky` job (not the main suite), that job may retry, and `integration` fails if the `@flaky` job fails

#### Scenario: Main suite excludes flaky entries

- **WHEN** a spec is listed in the `@flaky` list
- **THEN** the main e2e job does not execute that spec

### Requirement: E2E burn-in repeat count

The effective burn-in repeat count SHALL be the integer from environment variable `E2E_BURN_IN` when set to a positive integer, otherwise the default integer from `quality/gates.json` (which MUST remain the previously committed default), unless the roadmap item file for the change branch declares `Burn-in: N` with integer N greater than that default, in which case burn-in SHALL use N. The main e2e suite on the same workflow MUST use zero retries (see Zero retries for main Playwright e2e).

#### Scenario: Default repeat count from E2E_BURN_IN

- **WHEN** the roadmap item for the change does not declare a higher `Burn-in:` value and `E2E_BURN_IN` is unset or empty
- **THEN** burn-in uses `--repeat-each` equal to the default in `quality/gates.json`

#### Scenario: Roadmap Burn-in overrides default

- **WHEN** the roadmap item file for the change branch declares `Burn-in: 50`
- **THEN** burn-in uses `--repeat-each=50`

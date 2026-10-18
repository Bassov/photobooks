## ADDED Requirements

### Requirement: Zero retries for main Playwright e2e

On `pull_request` and `push`, the main Playwright e2e suite SHALL run with zero retries: the shared Playwright config MUST set retries to 0 in CI, and e2e specs MUST NOT declare per-spec or per-describe `retries` overrides. Failure traces SHALL use `retain-on-failure` (not only on first retry). Burn-in remains `--retries=0`.

#### Scenario: CI config has no retries

- **WHEN** CI runs the main e2e suite on a pull request or push
- **THEN** Playwright is configured with retries 0 and no e2e file under the main suite overrides retries above 0

#### Scenario: Traces retained on failure

- **WHEN** a main-suite e2e test fails with zero retries configured
- **THEN** Playwright retains a trace for that failure without requiring a retry attempt

### Requirement: Flaky e2e list and job

The repository SHALL maintain `e2e/flaky.json` as a JSON array of repo-relative Playwright spec paths that run only in a dedicated `@flaky` CI job (retries allowed). The main e2e suite MUST exclude those paths. `integration` MUST fail when a non-skipped `@flaky` job fails, and MUST accept a skipped job when the list is empty. The list MAY only shrink later via `quality/gates.json`.

#### Scenario: Empty flaky list skips job

- **WHEN** `e2e/flaky.json` is an empty list on a pull request
- **THEN** the `@flaky` job is skipped and `integration` still requires main e2e (and burn-in on pull requests) to succeed

#### Scenario: Non-empty flaky list is gated

- **WHEN** `e2e/flaky.json` lists one or more specs on a pull request
- **THEN** those specs run only in the `@flaky` job (not the main suite), that job may retry, and `integration` fails if the `@flaky` job fails

#### Scenario: Main suite excludes flaky entries

- **WHEN** a spec is listed in `e2e/flaky.json`
- **THEN** the main e2e job does not execute that spec

## MODIFIED Requirements

### Requirement: E2E burn-in on pull requests

On a pull request, CI SHALL run a burn-in of Playwright tests for added or changed `e2e/**/*.spec.ts` files and for e2e specs that import a changed e2e support file (`e2e/**/*.{ts,mts,js,mjs}` that is not `*.spec.ts`, including `e2e/fixtures/**` and `e2e/helpers/**`) directly or transitively through other e2e files, using `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count. Burn-in target selection SHALL exclude paths listed in `e2e/flaky.json`. That burn-in SHALL run as its own workflow job in parallel with the main e2e job (not as a prerequisite step after which the main e2e starts). The required check named `integration` SHALL still fail when the main e2e job fails, when the burn-in job fails (burn-in may be skipped on non-pull-request events), or when a non-skipped `@flaky` job fails.

#### Scenario: Changed spec is burned in

- **WHEN** a pull request adds or changes an `e2e/**/*.spec.ts` file
- **THEN** the burn-in job runs that file's tests with `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count

#### Scenario: Changed e2e support file pulls importers into burn-in

- **WHEN** a pull request changes an e2e support file under `e2e/fixtures/**`, `e2e/helpers/**`, or another non-spec e2e source path and one or more e2e specs import that file directly or transitively through other e2e files
- **THEN** those importing specs are included in the burn-in run with the same retries, workers, and repeat-each policy

#### Scenario: No burn-in targets

- **WHEN** a pull request changes no e2e specs and no e2e support files that any spec imports (directly or transitively)
- **THEN** the burn-in job exits successfully with a "no targets" outcome without installing Playwright browsers and without building the app

#### Scenario: Burn-in job is parallel with main e2e

- **WHEN** a pull request triggers the integration workflow
- **THEN** the burn-in job and the main e2e job start without one waiting on the other to finish, and the required `integration` gate job needs both

#### Scenario: Required integration gate fails when burn-in fails

- **WHEN** the burn-in job fails on a pull request
- **THEN** the required check named `integration` fails even if the main e2e job succeeded

#### Scenario: Timing-dependent test fails burn-in

- **WHEN** a deliberately timing-dependent test is exercised under the burn-in policy (`--repeat-each` with `--retries=0`)
- **THEN** the burn-in run fails (non-zero exit) rather than passing via retries

#### Scenario: Flaky-listed specs are not burned in

- **WHEN** a path listed in `e2e/flaky.json` would otherwise be a burn-in target
- **THEN** burn-in omits that path

#### Scenario: Required integration gate fails when flaky job fails

- **WHEN** the `@flaky` job runs on a pull request and fails
- **THEN** the required check named `integration` fails even if the main e2e and burn-in jobs succeeded

### Requirement: E2E burn-in repeat count

The effective burn-in repeat count SHALL be the integer from environment variable `E2E_BURN_IN` (default 10 when unset), unless the roadmap item file for the change branch declares `Burn-in: N` with integer N greater than that default, in which case burn-in SHALL use N. The main e2e suite on the same workflow MUST use zero retries (see Zero retries for main Playwright e2e).

#### Scenario: Default repeat count from E2E_BURN_IN

- **WHEN** the roadmap item for the change does not declare a higher `Burn-in:` value and `E2E_BURN_IN` is unset or set to 10
- **THEN** burn-in uses `--repeat-each=10`

#### Scenario: Roadmap Burn-in overrides default

- **WHEN** the roadmap item file for the change branch declares `Burn-in: 50`
- **THEN** burn-in uses `--repeat-each=50`

### Requirement: E2E metrics on the CI report comment

On a pull request, the integration workflow SHALL update the shared CI report comment's e2e section with the main-run retried-pass (flaky) count from Playwright JSON results, the `@flaky` list length from `e2e/flaky.json`, and, when burn-in ran, the burn-in repeat count used and the burn-in outcome (passed/failed, with failed test count when available). When burn-in had no targets, the e2e section MAY omit burn-in repeat metrics or report that burn-in had no targets. The main e2e suite SHALL still run even when burn-in fails so flaky counts can be reported.

#### Scenario: Flaky retry count from main run

- **WHEN** the main e2e suite on a pull request completes and at least one test passed only after a retry
- **THEN** the e2e section of the CI report comment includes that retried-pass count

#### Scenario: Burn-in count on the report

- **WHEN** burn-in ran on a pull request with a given repeat count
- **THEN** the e2e section of the CI report comment includes that burn-in count

#### Scenario: Burn-in outcome on the report

- **WHEN** burn-in ran on a pull request
- **THEN** the e2e section includes whether burn-in passed or failed, and when failed includes the failed test count from the burn-in Playwright JSON when present

#### Scenario: Zero flaky retries

- **WHEN** the main e2e suite completes with no retried passes
- **THEN** the e2e section reports a flaky (retried-pass) count of 0

#### Scenario: Flaky list count on the report

- **WHEN** the e2e section is written for a pull request
- **THEN** it includes the `@flaky` list length from `e2e/flaky.json` (0 when empty)

#### Scenario: Missing e2e JSON follows shared report rules

- **WHEN** no e2e JSON report is available because the producer failed before writing one
- **THEN** the e2e section follows the shared job-failed rules of the consolidated CI report comment

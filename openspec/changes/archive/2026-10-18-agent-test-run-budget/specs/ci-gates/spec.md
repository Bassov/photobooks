## MODIFIED Requirements

### Requirement: E2E burn-in on pull requests

On a pull request, CI SHALL run a burn-in of Playwright tests for added or changed `e2e/**/*.spec.ts` files and for e2e specs that import a changed e2e support file (`e2e/**/*.{ts,mts,js,mjs}` that is not `*.spec.ts`, including `e2e/fixtures/**` and `e2e/helpers/**`) directly or transitively through other e2e files, using `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count. That burn-in SHALL run as its own workflow job in parallel with the main integration e2e job (not as a prerequisite step after which integration starts).

#### Scenario: Changed spec is burned in

- **WHEN** a pull request adds or changes an `e2e/**/*.spec.ts` file
- **THEN** the burn-in job runs that file's tests with `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count

#### Scenario: Changed e2e support file pulls importers into burn-in

- **WHEN** a pull request changes an e2e support file under `e2e/fixtures/**`, `e2e/helpers/**`, or another non-spec e2e source path and one or more e2e specs import that file directly or transitively through other e2e files
- **THEN** those importing specs are included in the burn-in run with the same retries, workers, and repeat-each policy

#### Scenario: No burn-in targets

- **WHEN** a pull request changes no e2e specs and no e2e support files that any spec imports (directly or transitively)
- **THEN** the burn-in job exits successfully with a "no targets" outcome without installing Playwright browsers and without building the app

#### Scenario: Burn-in job is parallel with integration

- **WHEN** a pull request triggers the integration workflow
- **THEN** the burn-in job and the main integration e2e job start without one waiting on the other to finish

#### Scenario: Timing-dependent test fails burn-in

- **WHEN** a deliberately timing-dependent test is exercised under the burn-in policy (`--repeat-each` with `--retries=0`)
- **THEN** the burn-in run fails (non-zero exit) rather than passing via retries

### Requirement: E2E metrics on the CI report comment

On a pull request, the integration workflow SHALL update the shared CI report comment's e2e section with the main-run retried-pass (flaky) count from Playwright JSON results and, when burn-in ran, the burn-in repeat count used and the burn-in outcome (passed/failed, with failed test count when available). When burn-in had no targets, the e2e section MAY omit burn-in repeat metrics or report that burn-in had no targets. The main e2e suite SHALL still run even when burn-in fails so flaky counts can be reported.

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

#### Scenario: Missing e2e JSON follows shared report rules

- **WHEN** no e2e JSON report is available because the producer failed before writing one
- **THEN** the e2e section follows the shared job-failed rules of the consolidated CI report comment

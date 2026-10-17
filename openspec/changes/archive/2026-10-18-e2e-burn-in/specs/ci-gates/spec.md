## ADDED Requirements

### Requirement: E2E burn-in on pull requests

On a pull request, the integration workflow SHALL run a burn-in of Playwright tests for added or changed `e2e/**/*.spec.ts` files and for e2e specs that import a changed `e2e/helpers/**` file, using `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count.

#### Scenario: Changed spec is burned in

- **WHEN** a pull request adds or changes an `e2e/**/*.spec.ts` file
- **THEN** the integration workflow runs that file's tests with `--retries=0`, `--workers=1`, and `--repeat-each` equal to the effective burn-in count

#### Scenario: Changed helper pulls importers into burn-in

- **WHEN** a pull request changes a file under `e2e/helpers/**` and one or more e2e specs import that helper
- **THEN** those importing specs are included in the burn-in run with the same retries, workers, and repeat-each policy

#### Scenario: No burn-in targets

- **WHEN** a pull request changes no e2e specs and no e2e helpers that any spec imports
- **THEN** the burn-in step succeeds without running a Playwright burn-in

#### Scenario: Timing-dependent test fails burn-in

- **WHEN** a deliberately timing-dependent test is exercised under the burn-in policy
- **THEN** the burn-in run fails (non-zero exit) rather than passing via retries

### Requirement: E2E burn-in repeat count

The effective burn-in repeat count SHALL be the integer from environment variable `E2E_BURN_IN` (default 10 when unset), unless the roadmap item file for the change branch declares `Burn-in: N` with integer N greater than that default, in which case burn-in SHALL use N. The main e2e suite on the same workflow MAY keep its existing retry policy until a later change removes retries.

#### Scenario: Default repeat count from E2E_BURN_IN

- **WHEN** the roadmap item for the change does not declare a higher `Burn-in:` value and `E2E_BURN_IN` is unset or set to 10
- **THEN** burn-in uses `--repeat-each=10`

#### Scenario: Roadmap Burn-in overrides default

- **WHEN** the roadmap item file for the change branch declares `Burn-in: 50`
- **THEN** burn-in uses `--repeat-each=50`

### Requirement: E2E metrics on the CI report comment

On a pull request, the integration workflow SHALL update the shared CI report comment's e2e section with the main-run retried-pass (flaky) count from Playwright JSON results and, when burn-in ran, the burn-in repeat count used.

#### Scenario: Flaky retry count from main run

- **WHEN** the main e2e suite on a pull request completes and at least one test passed only after a retry
- **THEN** the e2e section of the CI report comment includes that retried-pass count

#### Scenario: Burn-in count on the report

- **WHEN** burn-in ran on a pull request with a given repeat count
- **THEN** the e2e section of the CI report comment includes that burn-in count

#### Scenario: Zero flaky retries

- **WHEN** the main e2e suite completes with no retried passes
- **THEN** the e2e section reports a flaky (retried-pass) count of 0

#### Scenario: Missing e2e JSON follows shared report rules

- **WHEN** no e2e JSON report is available because the producer failed before writing one
- **THEN** the e2e section follows the shared job-failed rules of the consolidated CI report comment

## MODIFIED Requirements

### Requirement: Consolidated CI report comment

On a pull request, the Lighthouse workflow, the diff-mutation workflow, the checks workflow, and the integration workflow SHALL update one shared CI report comment, each workflow only its own section. The comment SHALL NOT add a rollup table or a link whose only target is another section. Each section SHALL show its own status. When a succeeded section's summary markdown contains a two-column metric table, those metrics SHALL also appear in one horizontal row above that section's details disclosure.

#### Scenario: One comment and one section per workflow

- **WHEN** the Lighthouse, diff-mutation, checks, and integration workflows finish on the same pull request
- **THEN** the pull request has one CI report comment, Lighthouse results only in the Lighthouse section, mutation results only in the mutation section, coverage results only in the coverage section, and e2e results only in the e2e section

#### Scenario: Section is waiting

- **WHEN** a workflow has not yet written its section
- **THEN** that section shows Waiting and has no details disclosure

#### Scenario: Section is skipped

- **WHEN** the producer step succeeds and intentionally produces no report file
- **THEN** that section shows Skipped and has no details disclosure

#### Scenario: Section job failed

- **WHEN** the producer step fails or is skipped and no report file exists
- **THEN** that section shows Job failed and has no details disclosure

#### Scenario: Section job succeeded

- **WHEN** a report file exists for that section
- **THEN** the section shows Job succeeded, Check passed or Check failed matching the producer step outcome, one horizontal metric row when the summary has a metric table, and one details disclosure whose body is that check's existing summary markdown

#### Scenario: Repeat update keeps other sections

- **WHEN** one workflow updates its section again
- **THEN** the other sections keep their status and details disclosures are not nested

#### Scenario: Superseded head does not write

- **WHEN** a workflow run's commit is no longer the pull request head, including when that run was cancelled
- **THEN** the CI report comment is unchanged

#### Scenario: Legacy sticky comments are removed

- **WHEN** the CI report comment is created or updated
- **THEN** the separate Lighthouse, mutation, and coverage sticky comments are absent

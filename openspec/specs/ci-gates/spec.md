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

Unit test coverage SHALL enforce an **80%** floor in CI (statements, branches, functions, lines), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (project target 80%, PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

### Requirement: Coverage instrumentation scope

Vitest coverage SHALL include product sources under `src/**/*.{ts,tsx}` and SHALL exclude tests, benchmark files, TypeScript declaration files, test helpers (`*.test-helpers.ts`), and the app bootstrap entry `src/main.tsx`. Photo worker processing logic under `src/photo/` SHALL remain inside the coverage denominator (not excluded).

#### Scenario: Benches and declarations excluded

- **WHEN** coverage is collected
- **THEN** `*.bench.ts` / `*.benchmark.ts` and `*.d.ts` files do not reduce the coverage totals

#### Scenario: Worker processing is instrumented

- **WHEN** coverage is collected
- **THEN** photo worker processing code under `src/photo/` that implements file→preview/metadata processing is included in the coverage report

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

### Requirement: Nightly mutation stays off the CI report comment

The scheduled full mutation workflow SHALL NOT create or update the pull-request CI report comment.

#### Scenario: Nightly full mutation

- **WHEN** the scheduled full mutation workflow finishes
- **THEN** the pull-request CI report comment is unchanged

### Requirement: Lighthouse reporting on pull requests

The Lighthouse CI job on a pull request SHALL publish category scores and a link to the HTML report in the Lighthouse section of the CI report comment when LHCI output is available.

#### Scenario: Lighthouse sticky comment

- **WHEN** the Lighthouse workflow finishes on a pull request and LHCI output is available
- **THEN** the Lighthouse section's details include category scores and report link(s)

### Requirement: Mutation reporting on pull requests

The pull-request mutation job SHALL publish a PR-visible mutation summary in the mutation section of the CI report comment and a downloadable HTML mutation report, and SHALL write a job Step Summary with the mutation score. A successful run with no mutation report SHALL show Skipped only when no changed file is inside mutation scope.

#### Scenario: Mutation sticky comment and artifact

- **WHEN** the pull-request mutation workflow completes and a mutation report was produced
- **THEN** it uploads the HTML mutation report as an artifact and the mutation section's details include the mutation score summary

#### Scenario: Mutation Step Summary

- **WHEN** the pull-request mutation workflow produces a mutation report
- **THEN** the job Step Summary includes the mutation score and killed/survived counts

#### Scenario: Empty mutate set

- **WHEN** the pull-request mutation workflow succeeds without a mutation report file because no changed file is inside mutation scope
- **THEN** the mutation section shows Skipped and has no details disclosure

#### Scenario: In-scope change is not skipped

- **WHEN** a changed file is covered by mutation scope
- **THEN** the mutation workflow produces a mutation report and the mutation section does not show Skipped

### Requirement: Mutation scope is the config globs

Full and diff mutation runs SHALL share one mutate scope: the `mutate` globs in the mutation config. That scope SHALL include `src/**/*.ts` and `src/**/*.tsx` and SHALL exclude only files that are pointless to mutate. The diff run SHALL keep a changed file only when it matches an include glob and is not negated by an exclude, and MUST NOT keep a separate file allow-list.

#### Scenario: In-scope module is mutated

- **WHEN** a changed file is `src/photo/processPhoto.ts`
- **THEN** the diff mutation run includes that file

#### Scenario: Pointless files are excluded

- **WHEN** a changed file is a test, a bench, a declaration, a `*.test-helpers.ts` file, a fixture under `src/core/testing/`, the barrel `src/core/index.ts`, the Vite entry `src/main.tsx`, or `src/photo/photo.worker.ts`
- **THEN** the diff mutation run does not include that file

#### Scenario: Previously omitted module is mutated

- **WHEN** a changed file is production source that the previous allow-lists omitted, such as `src/perf/percentile.ts`
- **THEN** the diff mutation run includes that file

### Requirement: Unclassified production file fails checks

Fast verify and the checks workflow SHALL fail when a production TypeScript or TSX file under `src/` is neither covered by a mutate include glob nor negated by an exclude.

#### Scenario: New file with no decision

- **WHEN** a production `.ts` or `.tsx` file under `src/` matches neither an include glob nor an exclude
- **THEN** fast verify fails and the checks workflow fails

### Requirement: Codecov Test Analytics upload

The checks workflow SHALL upload Vitest unit-test results in JUnit XML form to Codecov Test Analytics whenever the unit-test step is attempted, including when those tests fail, as long as the job is not cancelled mid-upload.

#### Scenario: Test results uploaded on green unit tests

- **WHEN** the checks workflow finishes the unit-test coverage step successfully
- **THEN** a JUnit XML test-results report is uploaded to Codecov with the repository Codecov token when configured

#### Scenario: Test results uploaded when unit tests fail

- **WHEN** the unit-test coverage step fails because of failing tests
- **THEN** the workflow still uploads the available JUnit XML test-results report to Codecov (job not cancelled)

### Requirement: Codecov Components for product modules

Project Codecov configuration SHALL define Components for `src/photo/`, `src/perf/`, and `src/lib/`, and SHALL include component coverage in the Codecov pull-request comment layout.

#### Scenario: Module components declared

- **WHEN** Codecov processes the project configuration
- **THEN** components exist for photo, perf, and lib paths under `src/`

#### Scenario: Components appear in PR comment layout

- **WHEN** Codecov posts or updates its pull-request comment
- **THEN** the configured comment layout includes components

### Requirement: Codecov Bundle Analysis on CI build

The checks workflow Vite production build SHALL upload JavaScript bundle analysis to Codecov when a repository Codecov token is available in the build environment. Local or CI builds without that token MUST still succeed without requiring an upload.

#### Scenario: CI build uploads bundle stats with token

- **WHEN** the checks workflow runs `pnpm build` with a Codecov token configured
- **THEN** bundle analysis for the app Vite build is uploaded to Codecov

#### Scenario: Build without token skips upload

- **WHEN** `pnpm build` runs without a Codecov token in the environment
- **THEN** the build completes successfully without failing due to missing bundle upload

### Requirement: Informational Codecov bundle status

Project Codecov configuration SHALL treat bundle analysis commit status as informational (non-blocking) so bundle size changes do not fail CI by default.

#### Scenario: Bundle status does not block merge by config

- **WHEN** Codecov evaluates bundle analysis for a commit or pull request
- **THEN** the configured bundle analysis status is informational rather than a failing gate

### Requirement: Coverage Step Summary

The checks workflow SHALL write a compact coverage summary to the job Step Summary after coverage runs, and on pull requests SHALL record the same totals in the coverage section of the CI report comment when a coverage summary file is available.

#### Scenario: Coverage visible in Actions Summary

- **WHEN** the checks workflow finishes the coverage step
- **THEN** the job Step Summary includes coverage totals

#### Scenario: Coverage sticky comment on pull request

- **WHEN** the checks workflow produces coverage summary JSON on a pull request
- **THEN** the coverage section's details include coverage totals

#### Scenario: Coverage missing because the job failed

- **WHEN** the checks workflow finishes on a pull request without coverage summary JSON because an earlier step failed or the coverage step was skipped
- **THEN** the coverage section shows Job failed and has no details disclosure

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

### Requirement: E2E burn-in repeat count

The effective burn-in repeat count SHALL be the integer from environment variable `E2E_BURN_IN` (default 10 when unset), unless the roadmap item file for the change branch declares `Burn-in: N` with integer N greater than that default, in which case burn-in SHALL use N. The main e2e suite on the same workflow MAY keep its existing retry policy until a later change removes retries.

#### Scenario: Default repeat count from E2E_BURN_IN

- **WHEN** the roadmap item for the change does not declare a higher `Burn-in:` value and `E2E_BURN_IN` is unset or set to 10
- **THEN** burn-in uses `--repeat-each=10`

#### Scenario: Roadmap Burn-in overrides default

- **WHEN** the roadmap item file for the change branch declares `Burn-in: 50`
- **THEN** burn-in uses `--repeat-each=50`

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

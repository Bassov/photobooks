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

Unit test coverage SHALL enforce an **80%** floor in CI (statements, branches, functions, lines), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available. Project Codecov configuration SHALL set a blocking patch status at **85%** target with **0%** threshold (final; no planned raise). The blocking patch status SHALL evaluate the merged coverage of every uploaded flag (`unit` and `e2e`); an informational unit-only status MUST NOT replace the blocking patch check. Codecov SHALL wait for two coverage uploads per commit (`codecov.notify.after_n_builds: 2`) covering the `unit` and `e2e` flags before notifying, so `codecov/patch` is not finalized after the unit upload alone. The `e2e` flag MUST NOT carry forward (a prior commit must not satisfy `after_n_builds` without a fresh e2e upload). Enforced GitHub check from this change: `codecov/patch` only. Project no-drop status (`auto` / 0.5% plus 80% floor) and the expanded Components table are moved to backlog `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18; Codecov does not post those on this repo). YAML MAY retain matching `project.*` and `component_management` keys as valid harmless config without claiming they are enforced checks.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (blocking patch 85%, PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

#### Scenario: Patch under target fails codecov/patch

- **WHEN** a pull request's merged uploaded-flag patch coverage is below 85%
- **THEN** Codecov reports a failing `codecov/patch` status

#### Scenario: E2e-only line counts toward patch

- **WHEN** a changed line is covered by the `e2e` flag upload and not by the `unit` flag
- **THEN** that line counts as covered for the blocking `codecov/patch` evaluation

#### Scenario: Flags appear separately in the Codecov comment

- **WHEN** both `unit` and `e2e` coverage uploads succeed for a pull request
- **THEN** the Codecov pull-request comment shows `unit` and `e2e` as separate flags

### Requirement: Coverage instrumentation scope

Vitest coverage SHALL include product sources under `src/**/*.{ts,tsx}` and SHALL exclude tests, benchmark files, TypeScript declaration files, test helpers (`*.test-helpers.ts`), and the app bootstrap entry `src/main.tsx`. Photo worker processing logic under `src/photo/` SHALL remain inside the coverage denominator (not excluded).

#### Scenario: Benches and declarations excluded

- **WHEN** coverage is collected
- **THEN** `*.bench.ts` / `*.benchmark.ts` and `*.d.ts` files do not reduce the coverage totals

#### Scenario: Worker processing is instrumented

- **WHEN** coverage is collected
- **THEN** photo worker processing code under `src/photo/` that implements file→preview/metadata processing is included in the coverage report

### Requirement: E2E coverage instrumentation and upload

The Playwright e2e suite SHALL collect Istanbul coverage for `src/**` using the shared Vitest coverage exclude set, gated on `VITE_COVERAGE=1` for the Playwright `webServer` build only. Every e2e spec SHALL persist browser coverage via the shared fixture and merge it to lcov. The integration workflow SHALL upload that report to Codecov with `flags: e2e` and `fail_ci_if_error` when a token is available.

#### Scenario: Playwright build is instrumented

- **WHEN** Playwright starts its `webServer` with `E2E_COVERAGE=1` (which sets `VITE_COVERAGE=1` on that build only)
- **THEN** the served app exposes Istanbul `window.__coverage__` for included `src/**` modules

#### Scenario: Non-e2e builds stay clean

- **WHEN** a production, preview, or Lighthouse CI build runs without `VITE_COVERAGE=1`
- **THEN** the build output is not Istanbul-instrumented

#### Scenario: Specs persist and merge coverage

- **WHEN** the main e2e suite finishes
- **THEN** per-test coverage dumps are merged into `coverage-e2e/lcov.info` mapped back to `src/**`

#### Scenario: Failed e2e upload fails integration

- **WHEN** the integration workflow's Codecov e2e upload fails while a Codecov token is configured
- **THEN** the integration workflow fails

#### Scenario: Workers excluded from e2e coverage

- **WHEN** e2e coverage is collected
- **THEN** worker entry modules under `src/` do not appear as covered lines in the e2e report

### Requirement: Mutation stays unit-only despite e2e coverage

Diff and full mutation runs SHALL continue to execute only Vitest (not Playwright). A line covered solely by e2e SHALL still be reported as NoCoverage by `stryker-diff` when no unit test covers it. E2e coverage MUST NOT be treated as satisfying mutation or NoCoverage requirements.

#### Scenario: Stryker runner remains Vitest

- **WHEN** `stryker-diff` or full Stryker runs
- **THEN** the configured test runner is Vitest and Playwright is not invoked

#### Scenario: E2e-only coverage yields NoCoverage

- **WHEN** a mutated line is covered only by e2e and not by any unit test
- **THEN** `stryker-diff` reports that mutant as NoCoverage

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

The pull-request mutation job SHALL publish a PR-visible mutation summary in the mutation section of the CI report comment and a downloadable HTML mutation report, and SHALL write a job Step Summary with the mutation score. A successful run with no mutation report SHALL show Skipped only when no changed production file remains to mutate after accounting for `mutation.temporaryExcludes`. The summary SHALL list every Stryker disable comment in the mutated/changed files with its reason, SHALL report Ignored mutant counts per file (Ignored counts against that file), SHALL list each NoCoverage mutant with file:line and mutator, and SHALL list changed files that were not mutated.

#### Scenario: Mutation sticky comment and artifact

- **WHEN** the pull-request mutation workflow completes and a mutation report was produced
- **THEN** it uploads the HTML mutation report as an artifact and the mutation section's details include the mutation score summary

#### Scenario: Mutation Step Summary

- **WHEN** the pull-request mutation workflow produces a mutation report
- **THEN** the job Step Summary includes the mutation score and killed/survived counts

#### Scenario: Empty mutate set

- **WHEN** the pull-request mutation workflow succeeds without a mutation report file because no changed production file remains to mutate after `mutation.temporaryExcludes`
- **THEN** the mutation section shows Skipped and has no details disclosure

#### Scenario: In-scope change is not skipped

- **WHEN** a changed file is covered by mutation scope
- **THEN** the mutation workflow produces a mutation report and the mutation section does not show Skipped

#### Scenario: Disables and Ignored appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report for files that contain Stryker disable comments and/or Ignored mutants
- **THEN** the mutation summary lists each disable with its reason and shows Ignored counts per file

#### Scenario: NoCoverage and unmutated files appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report that includes NoCoverage mutants or changed files with no mutants
- **THEN** the mutation summary lists each NoCoverage mutant with file:line and mutator and lists those unmutated changed files

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

Project Codecov configuration SHALL define Components for `src/photo/`, `src/perf/`, and `src/lib/`, and SHALL include component coverage in the Codecov pull-request comment layout. Additional Components (`editor`, `project`, `assets`, `render`, `core`, `scripts`) and proof that the PR comment shows their table are moved to backlog `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18). YAML MAY declare those extra Components without treating the comment table as an enforced requirement of this change.

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

### Requirement: Stricter TypeScript indexed access and zero ESLint warnings

Application TypeScript configs SHALL enable `noUncheckedIndexedAccess`. The lint script SHALL run ESLint with `--max-warnings=0` so warnings fail the gate.

#### Scenario: Indexed access is checked

- **WHEN** `pnpm typecheck` runs
- **THEN** TypeScript enforces `noUncheckedIndexedAccess` for application sources

#### Scenario: ESLint warnings fail lint

- **WHEN** ESLint emits any warning
- **THEN** `pnpm lint` exits non-zero

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

The effective burn-in repeat count SHALL be the integer from environment variable `E2E_BURN_IN` when set to a positive integer, otherwise the default integer from `quality/gates.json` (which MUST remain the previously committed default), unless the roadmap item file for the change branch declares `Burn-in: N` with integer N greater than that default, in which case burn-in SHALL use N. The main e2e suite on the same workflow MUST use zero retries (see Zero retries for main Playwright e2e).

#### Scenario: Default repeat count from E2E_BURN_IN

- **WHEN** the roadmap item for the change does not declare a higher `Burn-in:` value and `E2E_BURN_IN` is unset or empty
- **THEN** burn-in uses `--repeat-each` equal to the default in `quality/gates.json`

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

### Requirement: Checks job uses unified check without weakening

The required CI `checks` job SHALL invoke `pnpm check` for the shared deterministic inventory that local pre-push uses. Every gate that job previously ran as a failing step (including format check, coverage, build, dist-header assert, and production audit) MUST still run in that same required job and MUST fail the job when it fails. The change MUST NOT move those gates to a non-required job or mark them `continue-on-error`.

#### Scenario: Shared inventory via pnpm check

- **WHEN** a pull request runs the checks workflow
- **THEN** the required `checks` job runs `pnpm check` (verbose in CI logs) for the shared local inventory

#### Scenario: Prior required steps still fail the job

- **WHEN** format check, coverage, build, dist-header assert, or production audit fails
- **THEN** the same required `checks` job fails and the failing step is not `continue-on-error`

### Requirement: Zero retries for main Playwright e2e

On `pull_request` and `push`, the main Playwright e2e suite SHALL run with zero retries: the shared Playwright config MUST set retries to 0 in CI, and e2e specs MUST NOT declare per-spec or per-describe `retries` overrides. Failure traces SHALL use `retain-on-failure` (not only on first retry). Burn-in remains `--retries=0`.

#### Scenario: CI config has no retries

- **WHEN** CI runs the main e2e suite on a pull request or push
- **THEN** Playwright is configured with retries 0 and no e2e file under the main suite overrides retries above 0

#### Scenario: Traces retained on failure

- **WHEN** a main-suite e2e test fails with zero retries configured
- **THEN** Playwright retains a trace for that failure without requiring a retry attempt

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

### Requirement: Central gate values file

Non-Codecov CI gate thresholds and gate lists SHALL live in `quality/gates.json`. Tool configs and loaders that apply those values MUST read them from that file (or a shared loader) and MUST NOT hardcode them. Committed `budget.json` and `e2e/flaky.json` mirrors, when present, MUST deep-equal the matching fields in that file. `quality/gates.json` SHALL include `mutation.disableBudget` (a non-negative integer ceiling on legal next-line Stryker disables), `stryker.diffThresholds` (`high` / `low` / `break` for the pull-request diff mutation run), and `mutation.temporaryExcludes` (shrink-only list of bang-excluded product paths with the roadmap item that removes each).

#### Scenario: Coverage floors come from gates file

- **WHEN** Vitest coverage thresholds are configured
- **THEN** statements, branches, functions, and lines floors are taken from `quality/gates.json` and match the previously committed floors

#### Scenario: Mutation thresholds come from gates file

- **WHEN** Stryker thresholds are configured
- **THEN** high, low, and break values for the nightly/full run are taken from `quality/gates.json` `stryker.thresholds` and match the previously committed thresholds

#### Scenario: Diff mutation thresholds come from gates file

- **WHEN** the pull-request diff Stryker thresholds are configured
- **THEN** high, low, and break values are taken from `quality/gates.json` `stryker.diffThresholds` and are applied via a diff config that spreads the nightly config

#### Scenario: Disable budget comes from gates file

- **WHEN** `pr-policy` evaluates the repo-wide Stryker disable ceiling
- **THEN** the ceiling is taken from `quality/gates.json` `mutation.disableBudget`

#### Scenario: Temporary excludes come from gates file

- **WHEN** the diff mutation runner decides whether a changed bang-excluded product file is allowed
- **THEN** the allowlist is taken from `quality/gates.json` `mutation.temporaryExcludes`

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

### Requirement: Gate ratchet on pull requests

On every pull request, CI SHALL run a `pr-policy` job from a `pull_request_target` workflow that executes only the **base** ref’s workflow and `scripts/check-gate-ratchet.mjs`. The head commit SHALL be read only as git object data; head code MUST NOT be installed or executed. The check SHALL fail when the head tree is weaker than base per the ratchet rules. No label, input, or environment override SHALL disable the ratchet. Diff mutation thresholds SHALL be at least as high as nightly thresholds on the same head. When base has no `mutation.temporaryExcludes` array, the head MAY introduce the initial path set; thereafter the set of paths SHALL only shrink relative to base.

#### Scenario: Weaker coverage floor fails pr-policy

- **WHEN** a pull request lowers a numeric floor or target in `quality/gates.json` or `codecov.yml` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Weaker diff mutation threshold fails pr-policy

- **WHEN** a pull request lowers a `stryker.diffThresholds` value relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Diff threshold below nightly fails pr-policy

- **WHEN** a pull request’s head has any `stryker.diffThresholds` value lower than the matching `stryker.thresholds` value
- **THEN** the `pr-policy` check fails

#### Scenario: Grown temporaryExcludes fails pr-policy

- **WHEN** base already has a `mutation.temporaryExcludes` array and a pull request adds a path that was not present on base
- **THEN** the `pr-policy` check fails

#### Scenario: Initial temporaryExcludes seed passes pr-policy

- **WHEN** base has no `mutation.temporaryExcludes` array and the head introduces the initial path set
- **THEN** the `pr-policy` check does not fail for that seed alone

#### Scenario: New exclude pattern fails pr-policy

- **WHEN** a pull request adds a Stryker `mutate` `!` pattern, a Vitest coverage exclude, or a Codecov `ignore` pattern relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Removed coverage include fails pr-policy

- **WHEN** a pull request removes `scripts/agent.mjs` (or any other entry) from Vitest coverage `include` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: New mutator exclusion fails pr-policy

- **WHEN** a pull request adds `mutator.excludedMutations` (or other weaker Stryker mutator options) relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: New ignore comment or Stryker disable fails pr-policy

- **WHEN** a pull request adds a `v8|istanbul|c8 ignore`, blanket `eslint-disable`, `@ts-ignore`, or an illegal `Stryker disable` (file-wide, `disable all`, or block `disable`/`restore`, including whitespace or case variants) relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Over per-file or repo disable budget fails pr-policy

- **WHEN** a pull request’s head has more than three legal next-line Stryker disables in one file, or more legal next-line disables repo-wide than `quality/gates.json` `mutation.disableBudget`
- **THEN** the `pr-policy` check fails

#### Scenario: Budgeted next-line disable within budget passes pr-policy

- **WHEN** a pull request adds only a legal `// Stryker disable next-line <Mutator>[,…]: <reason>` (reason ≥ 10 characters) and head totals stay within the per-file cap and `mutation.disableBudget`
- **THEN** the `pr-policy` check does not fail for that disable alone

#### Scenario: Raised disableBudget fails pr-policy

- **WHEN** a pull request raises `mutation.disableBudget` in `quality/gates.json` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Deleted ratchet rule fails pr-policy

- **WHEN** a pull request’s ratchet rule-id list is not a superset of base’s rule-id list
- **THEN** the `pr-policy` check fails

#### Scenario: Head workflow edit does not rejudge the PR

- **WHEN** a pull request edits `.github/workflows/pr-policy.yml` or `scripts/check-gate-ratchet.mjs` but does not weaken gate data relative to base
- **THEN** that pull request is still judged by the base ref’s workflow and script

### Requirement: Required-check gate steps stay binding

Versus base, a gate step (Playwright e2e or burn-in, Vitest coverage, Stryker, Lighthouse, gitleaks, or dependency audit) that ran inside a job listed in `quality/gates.json` `requiredCheckJobs` MUST NOT be removed, marked `continue-on-error`, or moved unless the required job `needs:` the new job and fails when it fails. Comparison SHALL be static YAML of workflow files.

#### Scenario: Burn-in moved without needs fails

- **WHEN** a pull request moves the burn-in step out of the `integration` job into a parallel job that `integration` does not `needs:`
- **THEN** the `pr-policy` check fails

#### Scenario: Burn-in moved with aggregating needs passes

- **WHEN** a pull request moves burn-in into a parallel job and the `integration` job `needs:` that job and fails when it fails
- **THEN** the `pr-policy` check does not fail for that move alone

### Requirement: Codecov YAML validity check

Local `pnpm check` (and the checks workflow) SHALL validate `codecov.yml` via Codecov’s validator (`POST https://api.codecov.io/validate`) and MUST fail unless the first line of the response body is exactly `Valid!` (a trailing normalized config dump is allowed). On a network error contacting that endpoint only, the check MAY fall back to a pinned allowlist of known top-level keys; a validation failure response MUST NOT use that fallback.

#### Scenario: Unknown top-level key fails check

- **WHEN** `codecov.yml` contains an unknown top-level key such as root-level `notify:` instead of `codecov: notify:`
- **THEN** `pnpm check` fails the codecov YAML validity step

#### Scenario: Main codecov.yml passes

- **WHEN** the committed repository `codecov.yml` is validated
- **THEN** the codecov YAML validity step passes

#### Scenario: Network error uses pinned key fallback only

- **WHEN** the Codecov validator endpoint cannot be reached due to a network error
- **THEN** the check applies the pinned top-level key allowlist and still fails on unknown keys

### Requirement: Test-level weakening fails pr-policy

The existing `pr-policy` / `check-gate-ratchet` compare (base-run, head as data only) SHALL fail when head adds skip/fixme/fail/todo/only forms or Playwright retries config in tracked Vitest/Playwright test files, detected by static TypeScript AST parse. New rule ids SHALL join the ratchet `RULE_IDS` / `FIXTURE_IDS` supersets.

#### Scenario: Added skip fails pr-policy

- **WHEN** a pull request adds a `.skip` (or `test.fixme` / `it.todo` / `.only`) call in a tracked test file relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Added per-spec retries fails pr-policy

- **WHEN** a pull request adds `test.describe.configure({ retries: 3 })` or a per-test `retries` option relative to base
- **THEN** the `pr-policy` check fails

### Requirement: Test-title inventory fails on deleted titles

A test title present on base and missing on head SHALL fail `pr-policy` unless the test file is deleted on head together with a companion source (same-dir module after stripping `.test`/`.spec`, or for e2e a deleted `src/**/<basename>.*`). A rename whose test body hash matches base SHALL pass. Deleting a test file alone (companion still on head) SHALL fail.

#### Scenario: Deleted Playwright title fails pr-policy

- **WHEN** a pull request removes a Playwright test title from a file that still exists on head
- **THEN** the `pr-policy` check fails

#### Scenario: Renamed test with unchanged body passes

- **WHEN** a pull request renames a test title but the test body hash matches base
- **THEN** the `pr-policy` check does not fail for that rename alone

#### Scenario: Deleted test file without companion fails

- **WHEN** a pull request deletes a tracked test file but the companion source remains on head
- **THEN** the `pr-policy` check fails

#### Scenario: Deleted test file with companion passes

- **WHEN** a pull request deletes a tracked test file and its companion source
- **THEN** the `pr-policy` check does not fail for that co-deletion alone

### Requirement: allowOnly and forbidOnly are ratcheted

Vitest configuration SHALL set `allowOnly: false`. Playwright configuration SHALL set `forbidOnly: true` (not only when CI is detected). The gate ratchet SHALL fail when head weakens either key relative to base (including changing `forbidOnly` from `true` to a CI-gated expression).

#### Scenario: forbidOnly false fails pr-policy

- **WHEN** a pull request sets Playwright `forbidOnly` to `false` (or a non-`true` value) relative to base `true`
- **THEN** the `pr-policy` check fails

#### Scenario: allowOnly true fails pr-policy

- **WHEN** a pull request sets Vitest `allowOnly` to `true` (or removes `false`) relative to base
- **THEN** the `pr-policy` check fails

### Requirement: ESLint forbids focused and skipped tests

`pnpm lint` SHALL error on focused tests, skipped/disabled tests, and conditional-in-test patterns in Vitest and Playwright files via exact-pinned `@vitest/eslint-plugin` (`no-focused-tests`, `no-disabled-tests`, `no-conditional-in-test`) and `eslint-plugin-playwright` (`no-focused-test`, `no-skipped-test`, `no-conditional-in-test`).

#### Scenario: Focused test fails lint

- **WHEN** a test file contains `test.only` / `it.only` / `describe.only`
- **THEN** `pnpm lint` fails

#### Scenario: Skipped test fails lint

- **WHEN** a test file contains `test.skip` / `it.skip` / `describe.skip`
- **THEN** `pnpm lint` fails

#### Scenario: Conditional in test fails lint

- **WHEN** a test body contains a conditional that the ESLint `no-conditional-in-test` rule flags
- **THEN** `pnpm lint` fails

### Requirement: Item done-criteria self-loosening fails pr-policy

In a pull request for roadmap item slug S, edits to `docs/roadmap/<milestone>/S.md` beyond checkbox ticks, `Status: done`, and a Done note SHALL fail `pr-policy` unless the PR body has `Owner-approved scope change: <link>`. A new roadmap item that names S or defers S's coverage/mutation/NoCoverage/e2e bar SHALL fail the same way. The workflow SHALL pass the PR body as `PR_POLICY_BODY` and re-run on body `edited`.

#### Scenario: Rewritten Done-when fails pr-policy

- **WHEN** a pull request rewrites its own item's Done-when lines without an `Owner-approved scope change:` line in the PR body
- **THEN** the `pr-policy` check fails

#### Scenario: Deferral roadmap item fails pr-policy

- **WHEN** a pull request adds a new roadmap item that names the current slug or defers its mutation/coverage/e2e bar, without owner approval in the PR body
- **THEN** the `pr-policy` check fails

#### Scenario: Checkbox ticks and Done note pass

- **WHEN** a pull request only ticks its item's Scope/Done-when boxes, sets `Status: done`, and adds a Done note
- **THEN** the `pr-policy` check does not fail for those item-file edits alone

### Requirement: Honest diff mutation gate

The pull-request diff mutation run SHALL use `stryker.diffThresholds` (break 85 on main after this change), SHALL fail when any mutant in the report has status NoCoverage, SHALL fail when a changed bang-excluded production file is not listed in `mutation.temporaryExcludes`, and SHALL NOT pass `--allowEmpty` when any production file changed. A skipped run while a production file outside the temporary-exclude allowlist changed SHALL fail with no override.

#### Scenario: Diff thresholds enforce break 85

- **WHEN** the diff mutation score is below `stryker.diffThresholds.break`
- **THEN** the diff mutation job fails

#### Scenario: NoCoverage fails the diff run

- **WHEN** the mutation report contains at least one NoCoverage mutant
- **THEN** the diff mutation job fails even if the score is at or above break

#### Scenario: Changed excluded file not on temporary list fails

- **WHEN** a pull request changes a bang-excluded production file whose path is not in `mutation.temporaryExcludes`
- **THEN** the diff mutation job fails

#### Scenario: Docs-only change skips

- **WHEN** a pull request changes no production file that is in mutation scope or subject to the temporary-exclude / unauthorized-exclude rules
- **THEN** the diff mutation job succeeds as skipped without a mutation report

#### Scenario: AllowEmpty dropped when production changed

- **WHEN** the diff runner invokes Stryker and at least one production file changed
- **THEN** the Stryker invocation does not include `--allowEmpty`

# ci-gates Specification

## Purpose

Defines CI quality and security gates for Photobooks on the public GitHub repository, including PR-visible coverage and mutation reporting, without replacing existing `audit:ci` or CodeQL.

## Requirements

### Requirement: Format, lint, types, knip, and deps

The checks workflow SHALL fail on Prettier drift (`format:check`). Application TypeScript SHALL enable `noUncheckedIndexedAccess`; `pnpm lint` SHALL use `--max-warnings=0`. `pnpm check` (and CI checks) SHALL fail on knip unused exports/files/deps and on dependency-cruiser forbidden imports (`src/lib` MUST NOT import React or photo/UI; listed pure `src/photo` helpers MUST NOT import React). ESLint SHALL forbid focused/skipped tests and conditional-in-test patterns via pinned Vitest and Playwright plugins.

#### Scenario: Format or lint failure blocks checks

- **WHEN** format drift, an ESLint warning, a knip violation, or a forbidden import is present
- **THEN** the corresponding gate in `pnpm check` / checks fails

### Requirement: Coverage floors, Codecov patch, and instrumentation

Unit coverage SHALL enforce an **80%** floor (statements/branches/functions/lines). Codecov SHALL block patch at **85%** / **0%** threshold on the merged `unit`+`e2e` flags (`codecov.notify.after_n_builds: 2`; `e2e` MUST NOT carry forward). Enforced GitHub check: `codecov/patch` only. Vitest coverage SHALL include `src/**/*.{ts,tsx}` and `scripts/**/*.mjs`, excluding tests, benches, `*.d.ts`, `*.test-helpers.ts`, `src/main.tsx`, and ≤10-line delegating CLI scripts. Photo worker processing under `src/photo/` stays in the denominator. Codecov `flags.unit.paths` SHALL include a `scripts/` prefix. Playwright e2e SHALL collect Istanbul coverage for `src/**` when `VITE_COVERAGE=1` (via `E2E_COVERAGE=1` on the Playwright build only), merge to `coverage-e2e/lcov.info`, and upload with `flags: e2e` (`fail_ci_if_error` when token present). Non-coverage builds MUST stay uninstrumented; worker entry modules are excluded from e2e coverage. Diff/full mutation SHALL remain Vitest-only; e2e-only lines remain NoCoverage for Stryker.

| Invariant                | Rule                                         |
| ------------------------ | -------------------------------------------- |
| Patch under 85%          | `codecov/patch` fails                        |
| Line covered only by e2e | counts for patch; NoCoverage for mutation    |
| New `scripts/foo.mjs`    | in coverage/mutate globs without config edit |

#### Scenario: Coverage and patch gates

- **WHEN** unit coverage is below 80% or merged patch coverage is below 85%
- **THEN** checks / `codecov/patch` fail accordingly

### Requirement: Dependency and secret security gates

Dependabot SHALL cover npm and GitHub Actions weekly. PRs SHALL run Dependency Review. `pnpm audit:ci` and CodeQL for JS/TS SHALL remain on checks/PRs/default branch. Secret lint SHALL fail on detected high-entropy secrets. Operator docs SHALL mention `CODECOV_TOKEN` and enabling GitHub secret scanning / push protection.

#### Scenario: Vulnerable lockfile or secret fails PR

- **WHEN** Dependency Review or secret lint flags a change
- **THEN** that workflow fails the pull request

### Requirement: Consolidated CI report comment

Lighthouse, diff-mutation, checks, and integration workflows SHALL update one shared CI report comment (one section each; no rollup-only links). Section states: Waiting / Skipped / Job failed / Job succeeded with Check passed|failed, optional horizontal metric row, and one details disclosure. Superseded heads MUST NOT write; legacy sticky comments MUST be removed. Nightly full mutation MUST NOT touch the PR comment. Lighthouse section SHALL include category scores and report links when available. Mutation section SHALL include score, HTML artifact, Step Summary, disables/Ignored/NoCoverage/unmutated lists; Skipped only when no mutate targets remain after `mutation.temporaryExcludes`. Coverage section SHALL mirror Step Summary totals. E2e section SHALL report main-run retried-pass count, `@flaky` list length, and burn-in repeat/outcome when burn-in ran.

#### Scenario: One comment with per-workflow sections

- **WHEN** the four producer workflows finish on a PR
- **THEN** one CI report comment holds Lighthouse, mutation, coverage, and e2e sections without nesting other sections' details

### Requirement: Mutation scope and unclassified files

Full and diff mutation SHALL share `mutate` globs: `src/**/*.ts(x)` and `scripts/**/*.mjs`, excluding pointless files (tests, benches, declarations, helpers, fixtures, barrels, `main.tsx`, worker shims, thin CLIs). Diff MUST NOT keep a separate allow-list. Fast verify / checks SHALL fail when a production `src/**/*.{ts,tsx}` or `scripts/**/*.mjs` (except tests/thin CLIs) matches neither include nor exclude.

#### Scenario: Unclassified production file fails

- **WHEN** a new production file is neither mutate-included nor excluded
- **THEN** `pnpm check` and the checks workflow fail

### Requirement: Codecov Test Analytics, Components, and Bundle

Checks SHALL upload Vitest JUnit to Codecov Test Analytics whenever the unit step is attempted (including failures, unless cancelled). Components SHALL exist for `src/photo/`, `src/perf/`, `src/lib/` in the PR comment layout (extra components may exist in YAML without being enforced). Vite production build SHALL upload bundle analysis when a token is present; without a token the build still succeeds. Bundle status SHALL be informational (non-blocking).

#### Scenario: Analytics and bundle with token

- **WHEN** checks run with a Codecov token
- **THEN** unit JUnit and bundle stats upload; bundle status does not block merge by config

### Requirement: E2E burn-in, retries, and flaky list

On PRs, CI SHALL burn-in changed `e2e/**/*.spec.ts` and specs importing changed e2e support files (`--retries=0`, `--workers=1`, `--repeat-each` = effective count), excluding `e2e/flaky.json` paths, as a job parallel with main e2e. Required `integration` fails if main e2e, burn-in (on PR), or a non-skipped `@flaky` job fails. Effective burn-in count: `E2E_BURN_IN` if set, else `quality/gates.json` default, else roadmap `Burn-in: N` when higher. Main e2e SHALL use zero retries (config + no per-spec overrides); traces `retain-on-failure`. `@flaky` list lives in `quality/gates.json` (mirrored by `e2e/flaky.json`); main suite excludes those paths; list MAY only shrink later.

#### Scenario: Changed spec burned in; integration aggregates

- **WHEN** a PR changes an e2e spec or imported support file
- **THEN** burn-in runs that target set in parallel with main e2e, and `integration` fails if burn-in fails

### Requirement: Checks job uses unified check

The required `checks` job SHALL invoke `pnpm check` for the shared deterministic inventory. Prior failing steps (format, coverage, build, dist-header assert, production audit) MUST still fail that same required job (no `continue-on-error`, no move to a non-required job).

#### Scenario: Shared inventory via pnpm check

- **WHEN** a PR runs the checks workflow
- **THEN** the required `checks` job runs `pnpm check` and still fails on format/coverage/build/audit failures

### Requirement: Central gate values and static check

Non-Codecov CI thresholds and lists SHALL live in `quality/gates.json` (consumers MUST NOT hardcode). Committed `budget.json` / `e2e/flaky.json` mirrors MUST deep-equal matching fields. Gates file SHALL include `mutation.disableBudget`, `stryker.diffThresholds`, and shrink-only `mutation.temporaryExcludes`. `pnpm check` SHALL statically fail hardcoded consumer literals or diverged mirrors. Lighthouse budgets SHALL also run on default-branch push.

#### Scenario: Hardcoded threshold or diverged mirror fails

- **WHEN** a listed consumer hardcodes a gate value or a mirror diverges
- **THEN** `pnpm check` fails

### Requirement: Gate ratchet on pull requests

`pr-policy` (`pull_request_target`, base workflow/script only; head as data) SHALL fail when head is weaker than base. No override disables the ratchet. Diff thresholds ≥ nightly on the same head. `mutation.temporaryExcludes` paths only shrink after initial seed. Coverage `include` / non-bang mutate removals fail unless a remaining glob subsumes them; dropping `scripts/**/*.mjs` from coverage or mutate fails. New bangs/excludes fail except paired scripts test/thin-CLI excludes when `scripts/**/*.mjs` is included. Codecov path drops fail without a covering prefix. Also fail: new mutator exclusions; illegal ignore/Stryker disable forms; over per-file (3) or repo `disableBudget`; raised `disableBudget`; deleted ratchet rule ids. Legal budgeted next-line disables within budget pass. Head edits to the ratchet workflow/script do not rejudge that PR.

| Weaker change                                    | Result |
| ------------------------------------------------ | ------ |
| Lower floor/target in gates or codecov           | fail   |
| Grown `temporaryExcludes` (after seed)           | fail   |
| Broad new `!scripts/**` / `!src/**/*.ts` exclude | fail   |
| Raised `agentRules.budgets` maxLines/maxChars    | fail   |

#### Scenario: Weaker coverage floor fails pr-policy

- **WHEN** a PR lowers a numeric floor or target relative to base
- **THEN** `pr-policy` fails

#### Scenario: Budgeted next-line disable within budget passes

- **WHEN** a PR adds only a legal next-line Stryker disable within budgets
- **THEN** that alone does not fail `pr-policy`

### Requirement: Required-check steps stay binding

Versus base, a gate step inside a `requiredCheckJobs` job MUST NOT be removed, marked `continue-on-error`, or moved unless the required job `needs:` the new job and fails when it fails (static YAML compare).

#### Scenario: Burn-in moved without needs fails

- **WHEN** burn-in moves to a parallel job that `integration` does not `needs:`
- **THEN** `pr-policy` fails

### Requirement: Codecov YAML validity

`pnpm check` SHALL validate `codecov.yml` via Codecov’s validator (first response line exactly `Valid!`). On network error only, a pinned top-level key allowlist MAY apply; validation failure responses MUST NOT use that fallback.

#### Scenario: Unknown top-level key fails

- **WHEN** `codecov.yml` has an unknown top-level key
- **THEN** the codecov YAML validity step fails

### Requirement: Test-level weakening and title inventory

`pr-policy` SHALL fail on added skip/fixme/fail/todo/only or Playwright retries in tracked tests (TS AST). A base test title missing on head fails unless the test file is deleted with its companion source; rename with matching body hash passes. Vitest `allowOnly: false` and Playwright `forbidOnly: true` are ratcheted.

#### Scenario: Added skip or deleted title fails

- **WHEN** a PR adds `.skip`/`.only` or removes a title from a surviving file
- **THEN** `pr-policy` fails

### Requirement: Item done-criteria self-loosening

In a PR for slug S, edits to `docs/roadmap/<milestone>/S.md` beyond checkbox ticks, `Status: done`, and a Done note SHALL fail unless the PR body has `Owner-approved scope change: <link>`. A new item that names/defers S's coverage/mutation/e2e bar fails the same way. Workflow passes `PR_POLICY_BODY` and re-runs on body `edited`.

#### Scenario: Rewritten Done-when fails

- **WHEN** a PR rewrites its own Done-when without owner approval in the body
- **THEN** `pr-policy` fails

### Requirement: Honest diff mutation gate

Diff mutation SHALL use `stryker.diffThresholds` (break 85), fail on any NoCoverage, fail when a changed bang-excluded production file is absent from `mutation.temporaryExcludes`, and MUST NOT pass `--allowEmpty` when any production file changed. Skipped while an unauthorized excluded production file changed SHALL fail.

#### Scenario: NoCoverage or unauthorized exclude fails

- **WHEN** the report has NoCoverage or a changed excluded file is not on the temporary list
- **THEN** the diff mutation job fails

### Requirement: Agent rule-file size budgets

`quality/gates.json` SHALL include `agentRules.budgets` (`{ path, maxLines, maxChars }` per scoped rule file). `pr-policy` SHALL fail on over-budget files, missing entries, or raised maxLines/maxChars vs base. Budgeted set MUST cover `AGENTS.md`, `.cursor/rules/*.mdc`, `next-roadmap-item.md`, `.cursor/agents/*.md`, and `openspec/config.yaml`.

#### Scenario: Over-budget rule file fails

- **WHEN** a budgeted rule file exceeds its maxLines or maxChars
- **THEN** `pr-policy` fails

### Requirement: OpenSpec capability spec line budgets

`quality/gates.json` SHALL include `openspecSpecs.softMaxLines` and `openspecSpecs.hardMaxLines`. Every `openspec/specs/*/spec.md` SHALL be checked by a deterministic script in `pnpm check`: exceeding soft emits a warning; exceeding hard fails. Raising either budget vs base SHALL fail `pr-policy` as a weaker gate.

#### Scenario: Over hard budget fails check

- **WHEN** any capability `spec.md` exceeds `hardMaxLines`
- **THEN** `pnpm check` fails the openspec budget step

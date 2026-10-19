## MODIFIED Requirements

### Requirement: Gate ratchet on pull requests

On every pull request, CI SHALL run a `pr-policy` job from a `pull_request_target` workflow that executes only the **base** ref’s workflow and `scripts/check-gate-ratchet.mjs`. The head commit SHALL be read only as git object data; head code MUST NOT be installed or executed. The check SHALL fail when the head tree is weaker than base per the ratchet rules. No label, input, or environment override SHALL disable the ratchet.

#### Scenario: Weaker coverage floor fails pr-policy

- **WHEN** a pull request lowers a numeric floor or target in `quality/gates.json` or `codecov.yml` relative to base
- **THEN** the `pr-policy` check fails

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

### Requirement: Mutation reporting on pull requests

The pull-request mutation job SHALL publish a PR-visible mutation summary in the mutation section of the CI report comment and a downloadable HTML mutation report, and SHALL write a job Step Summary with the mutation score. A successful run with no mutation report SHALL show Skipped only when no changed file is inside mutation scope. The summary SHALL list every Stryker disable comment in the mutated/changed files with its reason, and SHALL report Ignored mutant counts per file (Ignored counts against that file).

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

#### Scenario: Disables and Ignored appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report for files that contain Stryker disable comments and/or Ignored mutants
- **THEN** the mutation summary lists each disable with its reason and shows Ignored counts per file

### Requirement: Central gate values file

Non-Codecov CI gate thresholds and gate lists SHALL live in `quality/gates.json`. Tool configs and loaders that apply those values MUST read them from that file (or a shared loader) and MUST NOT hardcode them. Committed `budget.json` and `e2e/flaky.json` mirrors, when present, MUST deep-equal the matching fields in that file. `quality/gates.json` SHALL include `mutation.disableBudget` (a non-negative integer ceiling on legal next-line Stryker disables).

#### Scenario: Coverage floors come from gates file

- **WHEN** Vitest coverage thresholds are configured
- **THEN** statements, branches, functions, and lines floors are taken from `quality/gates.json` and match the previously committed floors

#### Scenario: Mutation thresholds come from gates file

- **WHEN** Stryker thresholds are configured
- **THEN** high, low, and break values are taken from `quality/gates.json` and match the previously committed thresholds

#### Scenario: Disable budget comes from gates file

- **WHEN** `pr-policy` evaluates the repo-wide Stryker disable ceiling
- **THEN** the ceiling is taken from `quality/gates.json` `mutation.disableBudget`

#### Scenario: Lighthouse gates come from gates file

- **WHEN** Lighthouse CI collect/assert settings and resource budgets are configured
- **THEN** run count, assertion levels, and budget limits are taken from `quality/gates.json` (with `budget.json` deep-equal when that mirror exists)

#### Scenario: Playwright retries come from gates file

- **WHEN** Playwright CI retry policy is configured
- **THEN** main-suite and `@flaky` project retry counts are taken from `quality/gates.json` and match the previously committed counts

#### Scenario: Burn-in default and flaky list come from gates file

- **WHEN** the effective burn-in default or the `@flaky` list is resolved without an overriding env/roadmap value
- **THEN** the default repeat count and the flaky spec list are taken from `quality/gates.json` (with `e2e/flaky.json` deep-equal when that mirror exists)

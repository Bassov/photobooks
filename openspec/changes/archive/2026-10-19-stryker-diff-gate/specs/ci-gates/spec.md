## MODIFIED Requirements

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

## ADDED Requirements

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

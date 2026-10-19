# ci-gates (delta)

## MODIFIED Requirements

### Requirement: Gate ratchet on pull requests

On every pull request, CI SHALL run a `pr-policy` job from a `pull_request_target` workflow that executes only the **base** ref’s workflow and `scripts/check-gate-ratchet.mjs`. The head commit SHALL be read only as git object data; head code MUST NOT be installed or executed. The check SHALL fail when the head tree is weaker than base per the ratchet rules. No label, input, or environment override SHALL disable the ratchet. Diff mutation thresholds SHALL be at least as high as nightly thresholds on the same head. When base has no `mutation.temporaryExcludes` array, the head MAY introduce the initial path set; thereafter the set of paths SHALL only shrink relative to base. A Vitest coverage `include` entry or a non-bang Stryker `mutate` entry removed relative to base SHALL fail unless a remaining head glob subsumes it. Removing `scripts/**` or `scripts/**/*.mjs` from coverage `include` or from Stryker `mutate` SHALL fail. New Stryker `!` bangs or Vitest coverage excludes for `scripts/**/*.test.mjs` or for a `scripts/` file that is both ≤10 lines and sole import+invoke of a sibling SHALL NOT fail when head coverage `include` already contains `scripts/**/*.mjs` (or `scripts/**`); any other new exclude (including broad globs such as `!scripts/**` or `!src/**/*.ts`, or a non-thin CLI) SHALL fail. Codecov `flags.unit.paths` SHALL treat a directory prefix (for example `scripts/`) as covering former per-file script paths under that prefix; dropping a path with no covering prefix SHALL fail.

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

- **WHEN** a pull request adds a Stryker `mutate` `!` pattern, a Vitest coverage exclude, or a Codecov `ignore` pattern relative to base, and that pattern is not a paired scripts test/CLI exclude allowed with `scripts/**/*.mjs` include
- **THEN** the `pr-policy` check fails

#### Scenario: Removed coverage include fails pr-policy

- **WHEN** a pull request removes a Vitest coverage `include` entry relative to base and no remaining head include glob subsumes it
- **THEN** the `pr-policy` check fails

#### Scenario: Removed scripts glob include fails pr-policy

- **WHEN** a pull request removes `scripts/**` or `scripts/**/*.mjs` from Vitest coverage `include` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Hand-list replaced by scripts glob passes pr-policy

- **WHEN** a pull request removes hand-listed `scripts/*.mjs` include entries but keeps `scripts/**/*.mjs`
- **THEN** the `pr-policy` check does not fail for those removals alone

#### Scenario: Hand-list mutate replaced by scripts glob passes pr-policy

- **WHEN** a pull request removes hand-listed `scripts/*.mjs` Stryker `mutate` entries but keeps `scripts/**/*.mjs`
- **THEN** the `pr-policy` check does not fail for those removals alone

#### Scenario: Removed mutate entry without covering glob fails pr-policy

- **WHEN** a pull request removes a non-bang Stryker `mutate` entry relative to base and no remaining head mutate glob subsumes it
- **THEN** the `pr-policy` check fails

#### Scenario: Broad new exclude fails pr-policy

- **WHEN** a pull request adds a new Stryker `!` bang or Vitest coverage exclude such as `!scripts/**` or `!src/**/*.ts` that is not a paired scripts test/CLI exclude
- **THEN** the `pr-policy` check fails

#### Scenario: Non-thin CLI exclude fails pr-policy

- **WHEN** a pull request adds a new exclude for a `scripts/` file that is not ≤10 lines with sole sibling import+invoke, even when `scripts/**/*.mjs` is in coverage include
- **THEN** the `pr-policy` check fails

#### Scenario: Codecov path dropped without covering prefix fails pr-policy

- **WHEN** a pull request removes a `flags.*.paths` entry relative to base and no remaining head path equals it or is a directory prefix covering it
- **THEN** the `pr-policy` check fails

#### Scenario: Scripts-in-scope config replay passes pr-policy

- **WHEN** the ratchet compares the real pre-`scripts-in-scope` gate configs to the real post-`scripts-in-scope` gate configs (coverage include glob, mutate glob, Codecov `scripts/`, paired test/CLI excludes)
- **THEN** the `pr-policy` check reports zero violations for that config delta alone

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

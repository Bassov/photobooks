# ci-gates (delta)

## MODIFIED Requirements

### Requirement: Coverage instrumentation scope

Vitest coverage SHALL include product sources under `src/**/*.{ts,tsx}` and production gate/agent scripts under `scripts/**/*.mjs`, and SHALL exclude tests (including `scripts/**/*.test.mjs`), benchmark files, TypeScript declaration files, test helpers (`*.test-helpers.ts`), the app bootstrap entry `src/main.tsx`, and ≤10-line delegating CLI entry scripts under `scripts/` (for example `scripts/agent-cli.mjs`). Photo worker processing logic under `src/photo/` SHALL remain inside the coverage denominator (not excluded). Codecov `flags.unit.paths` SHALL include a `scripts/` prefix covering those production scripts (not a per-file hand-list).

#### Scenario: Benches and declarations excluded

- **WHEN** coverage is collected
- **THEN** `*.bench.ts` / `*.benchmark.ts` and `*.d.ts` files do not reduce the coverage totals

#### Scenario: Worker processing is instrumented

- **WHEN** coverage is collected
- **THEN** photo worker processing code under `src/photo/` that implements file→preview/metadata processing is included in the coverage report

#### Scenario: New script is in the coverage denominator without config edit

- **WHEN** a new production file `scripts/foo.mjs` is added and unit tests import it
- **THEN** coverage includes that file without editing Vitest coverage `include` globs

### Requirement: Mutation scope is the config globs

Full and diff mutation runs SHALL share one mutate scope: the `mutate` globs in the mutation config. That scope SHALL include `src/**/*.ts`, `src/**/*.tsx`, and `scripts/**/*.mjs`, and SHALL exclude only files that are pointless to mutate (including `scripts/**/*.test.mjs` and ≤10-line delegating CLI entries under `scripts/`). The diff run SHALL keep a changed file only when it matches an include glob and is not negated by an exclude, and MUST NOT keep a separate file allow-list.

#### Scenario: In-scope module is mutated

- **WHEN** a changed file is `src/photo/processPhoto.ts`
- **THEN** the diff mutation run includes that file

#### Scenario: Pointless files are excluded

- **WHEN** a changed file is a test, a bench, a declaration, a `*.test-helpers.ts` file, a fixture under `src/core/testing/`, the barrel `src/core/index.ts`, the Vite entry `src/main.tsx`, `src/photo/photo.worker.ts`, a `scripts/**/*.test.mjs` file, or a ≤10-line delegating CLI under `scripts/`
- **THEN** the diff mutation run does not include that file

#### Scenario: Previously omitted module is mutated

- **WHEN** a changed file is production source that the previous allow-lists omitted, such as `src/perf/percentile.ts`
- **THEN** the diff mutation run includes that file

#### Scenario: New script is mutated without config edit

- **WHEN** a changed production file is `scripts/foo.mjs` and mutate already includes `scripts/**/*.mjs`
- **THEN** the diff mutation run includes that file without editing the mutation config

### Requirement: Unclassified production file fails checks

Fast verify and the checks workflow SHALL fail when a production TypeScript or TSX file under `src/`, or a production `.mjs` file under `scripts/` (excluding `scripts/**/*.test.mjs` and ≤10-line delegating CLI entries that are bang-excluded), is neither covered by a mutate include glob nor negated by an exclude.

#### Scenario: New file with no decision

- **WHEN** a production `.ts` or `.tsx` file under `src/` matches neither an include glob nor an exclude
- **THEN** fast verify fails and the checks workflow fails

#### Scenario: Unclassified script fails verify

- **WHEN** a production `scripts/*.mjs` file matches neither a mutate include glob nor an exclude
- **THEN** fast verify fails and the checks workflow fails

### Requirement: Gate ratchet on pull requests

On every pull request, CI SHALL run a `pr-policy` job from a `pull_request_target` workflow that executes only the **base** ref’s workflow and `scripts/check-gate-ratchet.mjs`. The head commit SHALL be read only as git object data; head code MUST NOT be installed or executed. The check SHALL fail when the head tree is weaker than base per the ratchet rules. No label, input, or environment override SHALL disable the ratchet. Diff mutation thresholds SHALL be at least as high as nightly thresholds on the same head. When base has no `mutation.temporaryExcludes` array, the head MAY introduce the initial path set; thereafter the set of paths SHALL only shrink relative to base. A Vitest coverage `include` entry removed relative to base SHALL fail unless a remaining head include glob subsumes it. Removing `scripts/**` or `scripts/**/*.mjs` from coverage `include` SHALL fail. New Stryker `!` bangs or Vitest coverage excludes for `scripts/**/*.test.mjs` or for a `scripts/` file that is both ≤10 lines and sole import+invoke of a sibling SHALL NOT fail when head coverage `include` already contains `scripts/**/*.mjs` (or `scripts/**`). Codecov `flags.unit.paths` SHALL treat a directory prefix (for example `scripts/`) as covering former per-file script paths under that prefix.

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

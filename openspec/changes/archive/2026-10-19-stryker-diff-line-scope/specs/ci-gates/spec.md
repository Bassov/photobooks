## ADDED Requirements

### Requirement: Diff mutation scores only changed lines

The pull-request diff mutation run SHALL mutate and score only new-side changed line ranges (Stryker `path:start-end`) from the base diff for in-scope files. Break threshold and NoCoverage apply only to mutants on those ranges; outside-range mutants MUST NOT fail the gate. The log and mutation summary SHALL list scored ranges. Empty scored ranges skip without Stryker; non-empty ranges always invoke Stryker (zero mutants on that set may pass via ranged `--allowEmpty` only).

#### Scenario: Comment-only or non-mutable changed lines pass without whole-file score

- **WHEN** an in-scope production file below the break threshold is changed only by comments or by lines that yield no mutants (non-empty scored `path:start-end` ranges)
- **THEN** the diff mutation run invokes Stryker on those ranges only (ranged `--allowEmpty` allowed), records zero scored mutants, and succeeds without applying the whole-file historical score

#### Scenario: NoCoverage on a changed line fails

- **WHEN** a scored changed line produces a NoCoverage mutant
- **THEN** the diff mutation gate fails and the summary lists that mutant with file:line and mutator

#### Scenario: Changed-line score below break fails

- **WHEN** mutants on scored changed lines yield a mutation score below `stryker.diffThresholds.break`
- **THEN** the diff mutation gate fails

#### Scenario: Deleted-only or empty new-side ranges do not fail

- **WHEN** a changed in-scope file has only deleted lines (no new-side hunk lines) or otherwise no mutable changed-line ranges
- **THEN** that file contributes no mutate ranges, and if no other scored ranges exist the run succeeds without failure

#### Scenario: Scored ranges appear in the report

- **WHEN** the diff mutation run mutates one or more line ranges
- **THEN** the mutate list / mutation summary states each scored `path:start-end` range

## MODIFIED Requirements

### Requirement: Mutation reporting on pull requests

The pull-request mutation job SHALL publish a PR-visible mutation summary (CI report mutation section), HTML artifact, and Step Summary score. Skipped (no report) only when no scored changed-line ranges remain after `mutation.temporaryExcludes`. The summary SHALL list disables with reasons, Ignored counts per file, NoCoverage with file:line and mutator, unmutated changed files, and scored `path:start-end` ranges.

#### Scenario: Mutation sticky comment and artifact

- **WHEN** the pull-request mutation workflow completes and a mutation report was produced
- **THEN** it uploads the HTML mutation report as an artifact and the mutation section's details include the mutation score summary

#### Scenario: Mutation Step Summary

- **WHEN** the pull-request mutation workflow produces a mutation report
- **THEN** the job Step Summary includes the mutation score and killed/survived counts

#### Scenario: Empty mutate set

- **WHEN** the pull-request mutation workflow succeeds without a mutation report file because no scored changed-line ranges remain to mutate after `mutation.temporaryExcludes`
- **THEN** the mutation section shows Skipped and has no details disclosure

#### Scenario: In-scope change is not skipped

- **WHEN** a changed file is covered by mutation scope and has at least one mutable changed-line range
- **THEN** the mutation workflow produces a mutation report and the mutation section does not show Skipped

#### Scenario: Disables and Ignored appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report for files that contain Stryker disable comments and/or Ignored mutants
- **THEN** the mutation summary lists each disable with its reason and shows Ignored counts per file

#### Scenario: NoCoverage and unmutated files appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report that includes NoCoverage mutants or changed files with no mutants
- **THEN** the mutation summary lists each NoCoverage mutant with file:line and mutator and lists those unmutated changed files

#### Scenario: Scored ranges appear in the mutation summary

- **WHEN** the pull-request mutation workflow produces a mutation report for scored line ranges
- **THEN** the mutation summary lists each scored `path:start-end` range

### Requirement: Mutation scope is the config globs

Full and diff mutation share the config `mutate` globs (`src/**/*.ts(x)`, `scripts/**/*.mjs`; exclude pointless files including `scripts/**/*.test.mjs` and ≤10-line delegating CLIs). Diff keeps a changed file only when include-matched and not bang-excluded (no separate allow-list), then restricts mutation to new-side changed-line ranges; it MUST NOT whole-file mutate solely because the path changed.

#### Scenario: In-scope module is mutated

- **WHEN** a changed file is `src/photo/processPhoto.ts` and the diff adds or modifies lines in that file
- **THEN** the diff mutation run includes mutation ranges for those changed lines of that file

#### Scenario: Pointless files are excluded

- **WHEN** a changed file is a test, a bench, a declaration, a `*.test-helpers.ts` file, a fixture under `src/core/testing/`, the barrel `src/core/index.ts`, the Vite entry `src/main.tsx`, `src/photo/photo.worker.ts`, a `scripts/**/*.test.mjs` file, or a ≤10-line delegating CLI under `scripts/`
- **THEN** the diff mutation run does not include that file

#### Scenario: Previously omitted module is mutated

- **WHEN** a changed file is production source that the previous allow-lists omitted, such as `src/perf/percentile.ts`, and the diff changes lines in that file
- **THEN** the diff mutation run includes mutation ranges for those changed lines of that file

#### Scenario: New script is mutated without config edit

- **WHEN** a changed production file is `scripts/foo.mjs` and mutate already includes `scripts/**/*.mjs`
- **THEN** the diff mutation run includes that file's changed-line ranges without editing the mutation config

#### Scenario: Unchanged lines in a touched file are not scored

- **WHEN** an in-scope production file is modified only on a subset of its lines
- **THEN** the diff mutation run does not place mutants on lines outside the new-side changed ranges of that file into the scored set

### Requirement: Honest diff mutation gate

Diff mutation SHALL use `stryker.diffThresholds` (unchanged in `quality/gates.json`), fail NoCoverage only for mutants on scored changed-line ranges, fail unauthorized bang-excludes not in `mutation.temporaryExcludes`, and invoke Stryker whenever any scored range exists. Skip is OK when production paths changed but no scored ranges remain. `--allowEmpty` only for `path:start-end` entries; outside-range mutants MUST NOT fail the gate.

#### Scenario: Diff thresholds enforce break 85

- **WHEN** the mutation score over scored changed-line mutants is below `stryker.diffThresholds.break`
- **THEN** the diff mutation job fails

#### Scenario: NoCoverage fails the diff run

- **WHEN** the mutation report contains at least one NoCoverage mutant whose start line is inside a scored changed-line range
- **THEN** the diff mutation job fails even if the scored score is at or above break

#### Scenario: NoCoverage outside scored ranges is ignored

- **WHEN** the mutation report contains NoCoverage mutants only outside scored changed-line ranges
- **THEN** those mutants do not fail the NoCoverage gate

#### Scenario: Changed excluded file not on temporary list fails

- **WHEN** a pull request changes a bang-excluded production file whose path is not in `mutation.temporaryExcludes`
- **THEN** the diff mutation job fails

#### Scenario: Docs-only change skips

- **WHEN** a pull request changes no production file that is in mutation scope or subject to the temporary-exclude / unauthorized-exclude rules
- **THEN** the diff mutation job succeeds as skipped without a mutation report

#### Scenario: Empty scored ranges skip while production path changed

- **WHEN** an in-scope production file changed but no scored changed-line ranges remain (deleted-only new-side empty, or equivalent empty range set)
- **THEN** the diff mutation job succeeds as skipped without failing for “production changed”

#### Scenario: AllowEmpty dropped when production changed

- **WHEN** the mutate set is whole files without mutation ranges and at least one production file changed
- **THEN** the Stryker invocation does not include `--allowEmpty`

#### Scenario: Ranged allowEmpty when mutate entries are ranges

- **WHEN** the diff runner invokes Stryker with only `path:start-end` mutate entries
- **THEN** the invocation MAY include `--allowEmpty` so zero mutants on those ranges succeed

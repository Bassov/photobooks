# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

# Spec Delta

## MODIFIED Requirements

### Requirement: Coverage thresholds and Codecov

Unit test coverage SHALL enforce an **80%** floor in CI (statements, branches, functions, lines), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available. Project Codecov configuration SHALL set a blocking patch status at **85%** target with **0%** threshold (final; no planned raise), a project default status with `target: auto` and **0.5%** threshold, and a separate project floor status at **80%** so neither the absolute floor nor drop tolerance gets weaker. The blocking patch status SHALL evaluate the merged coverage of every uploaded flag (unit now; e2e once that flag is uploaded); an informational unit-only status MUST NOT replace the blocking patch check.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (blocking patch 85%, project auto with 0.5% threshold plus 80% floor, PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

#### Scenario: Patch under target fails codecov/patch

- **WHEN** a pull request's merged uploaded-flag patch coverage is below 85%
- **THEN** Codecov reports a failing `codecov/patch` status

#### Scenario: Project coverage drop beyond threshold fails codecov/project

- **WHEN** a pull request drops overall project coverage by more than 0.5% relative to its base
- **THEN** Codecov reports a failing project status (`codecov/project` or the named default project status)

### Requirement: Codecov Components for product modules

Project Codecov configuration SHALL define Components for `src/photo/`, `src/perf/`, `src/lib/`, `src/editor/`, `src/project/`, `src/assets/`, `src/render/`, `src/core/`, and `scripts/`, and SHALL include component coverage in the Codecov pull-request comment layout.

#### Scenario: Module components declared

- **WHEN** Codecov processes the project configuration
- **THEN** components exist for photo, perf, lib, editor, project, assets, render, core, and scripts paths

#### Scenario: Components appear in PR comment layout

- **WHEN** Codecov posts or updates its pull-request comment
- **THEN** the configured comment layout includes components and the comment shows at least the editor, project, assets, and scripts components

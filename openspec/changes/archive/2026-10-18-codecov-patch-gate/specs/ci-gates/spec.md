# Spec Delta

## MODIFIED Requirements

### Requirement: Coverage thresholds and Codecov

Unit test coverage SHALL enforce an **80%** floor in CI (statements, branches, functions, lines), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available. Project Codecov configuration SHALL set a blocking patch status at **85%** target with **0%** threshold (final; no planned raise). The blocking patch status SHALL evaluate the merged coverage of every uploaded flag (unit now; e2e once that flag is uploaded); an informational unit-only status MUST NOT replace the blocking patch check. Enforced GitHub check from this change: `codecov/patch` only. Project no-drop status (`auto` / 0.5% plus 80% floor) and the expanded Components table are moved to backlog `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18; Codecov does not post those on this repo). YAML MAY retain matching `project.*` and `component_management` keys as valid harmless config without claiming they are enforced checks.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (blocking patch 85%, PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

#### Scenario: Patch under target fails codecov/patch

- **WHEN** a pull request's merged uploaded-flag patch coverage is below 85%
- **THEN** Codecov reports a failing `codecov/patch` status

### Requirement: Codecov Components for product modules

Project Codecov configuration SHALL define Components for `src/photo/`, `src/perf/`, and `src/lib/`, and SHALL include component coverage in the Codecov pull-request comment layout. Additional Components (`editor`, `project`, `assets`, `render`, `core`, `scripts`) and proof that the PR comment shows their table are moved to backlog `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18). YAML MAY declare those extra Components without treating the comment table as an enforced requirement of this change.

#### Scenario: Module components declared

- **WHEN** Codecov processes the project configuration
- **THEN** components exist for photo, perf, and lib paths under `src/`

#### Scenario: Components appear in PR comment layout

- **WHEN** Codecov posts or updates its pull-request comment
- **THEN** the configured comment layout includes components

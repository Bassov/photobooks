## ADDED Requirements

### Requirement: Coverage floor is eighty percent

Unit test coverage SHALL enforce a hard floor of **80%** for statements, branches, functions, and lines in Vitest, and Codecov project target SHALL be **80%**.

#### Scenario: Coverage below eighty percent fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if any of statements, branches, functions, or lines coverage is below 80%

#### Scenario: Codecov project target is eighty percent

- **WHEN** coverage is uploaded to Codecov
- **THEN** the project Codecov config uses an 80% target for the default project status

### Requirement: Coverage instrumentation scope

Vitest coverage SHALL include product sources under `src/**/*.{ts,tsx}` and SHALL exclude tests, benchmark files, TypeScript declaration files, test helpers (`*.test-helpers.ts`), and the app bootstrap entry `src/main.tsx`. Photo worker processing logic SHALL remain inside the coverage denominator (not excluded).

#### Scenario: Benches and declarations excluded

- **WHEN** coverage is collected
- **THEN** `*.bench.ts` / `*.benchmark.ts` and `*.d.ts` files do not reduce the coverage totals

#### Scenario: Worker processing is instrumented

- **WHEN** coverage is collected
- **THEN** photo worker processing code under `src/photo/` that implements file→preview/metadata processing is included in the coverage report

## MODIFIED Requirements

### Requirement: Coverage thresholds and Codecov

Unit test coverage SHALL enforce an **80%** floor in CI (not a historical no-regression snapshot), and coverage results SHALL be uploaded to Codecov with configuration that enables PR comments when a Codecov token is available.

#### Scenario: Coverage below floor fails checks

- **WHEN** the checks workflow runs unit tests with coverage
- **THEN** the job fails if measured coverage is below the configured Vitest thresholds (80% statements, branches, functions, lines)

#### Scenario: Codecov upload and PR comment config

- **WHEN** coverage is produced in the checks workflow
- **THEN** coverage is uploaded to Codecov using the project Codecov config (PR comments enabled even when coverage is unchanged) and a repository Codecov token when configured

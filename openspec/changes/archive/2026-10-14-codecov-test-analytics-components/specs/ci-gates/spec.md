## ADDED Requirements

### Requirement: Codecov Test Analytics upload

The checks workflow SHALL upload Vitest unit-test results in JUnit XML form to Codecov Test Analytics whenever the unit-test step is attempted, including when those tests fail, as long as the job is not cancelled mid-upload.

#### Scenario: Test results uploaded on green unit tests

- **WHEN** the checks workflow finishes the unit-test coverage step successfully
- **THEN** a JUnit XML test-results report is uploaded to Codecov with the repository Codecov token when configured

#### Scenario: Test results uploaded when unit tests fail

- **WHEN** the unit-test coverage step fails because of failing tests
- **THEN** the workflow still uploads the available JUnit XML test-results report to Codecov (job not cancelled)

### Requirement: Codecov Components for product modules

Project Codecov configuration SHALL define Components for `src/photo/`, `src/perf/`, and `src/lib/`, and SHALL include component coverage in the Codecov pull-request comment layout.

#### Scenario: Module components declared

- **WHEN** Codecov processes the project configuration
- **THEN** components exist for photo, perf, and lib paths under `src/`

#### Scenario: Components appear in PR comment layout

- **WHEN** Codecov posts or updates its pull-request comment
- **THEN** the configured comment layout includes components

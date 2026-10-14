## ADDED Requirements

### Requirement: Codecov Bundle Analysis on CI build

The checks workflow Vite production build SHALL upload JavaScript bundle analysis to Codecov when a repository Codecov token is available in the build environment. Local or CI builds without that token MUST still succeed without requiring an upload.

#### Scenario: CI build uploads bundle stats with token

- **WHEN** the checks workflow runs `pnpm build` with a Codecov token configured
- **THEN** bundle analysis for the app Vite build is uploaded to Codecov

#### Scenario: Build without token skips upload

- **WHEN** `pnpm build` runs without a Codecov token in the environment
- **THEN** the build completes successfully without failing due to missing bundle upload

### Requirement: Informational Codecov bundle status

Project Codecov configuration SHALL treat bundle analysis commit status as informational (non-blocking) so bundle size changes do not fail CI by default.

#### Scenario: Bundle status does not block merge by config

- **WHEN** Codecov evaluates bundle analysis for a commit or pull request
- **THEN** the configured bundle analysis status is informational rather than a failing gate

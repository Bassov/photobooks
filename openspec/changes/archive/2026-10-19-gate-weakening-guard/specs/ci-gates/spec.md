## ADDED Requirements

### Requirement: Test-level weakening fails pr-policy

The existing `pr-policy` / `check-gate-ratchet` compare (base-run, head as data only) SHALL fail when head adds skip/fixme/fail/todo/only forms or Playwright retries config in tracked Vitest/Playwright test files, detected by static TypeScript AST parse. New rule ids SHALL join the ratchet `RULE_IDS` / `FIXTURE_IDS` supersets.

#### Scenario: Added skip fails pr-policy

- **WHEN** a pull request adds a `.skip` (or `test.fixme` / `it.todo` / `.only`) call in a tracked test file relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Added per-spec retries fails pr-policy

- **WHEN** a pull request adds `test.describe.configure({ retries: 3 })` or a per-test `retries` option relative to base
- **THEN** the `pr-policy` check fails

### Requirement: Test-title inventory fails on deleted titles

A test title present on base and missing on head SHALL fail `pr-policy` unless the test file is deleted on head together with a companion source (same-dir module after stripping `.test`/`.spec`, or for e2e a deleted `src/**/<basename>.*`). A rename whose test body hash matches base SHALL pass. Deleting a test file alone (companion still on head) SHALL fail.

#### Scenario: Deleted Playwright title fails pr-policy

- **WHEN** a pull request removes a Playwright test title from a file that still exists on head
- **THEN** the `pr-policy` check fails

#### Scenario: Renamed test with unchanged body passes

- **WHEN** a pull request renames a test title but the test body hash matches base
- **THEN** the `pr-policy` check does not fail for that rename alone

#### Scenario: Deleted test file without companion fails

- **WHEN** a pull request deletes a tracked test file but the companion source remains on head
- **THEN** the `pr-policy` check fails

#### Scenario: Deleted test file with companion passes

- **WHEN** a pull request deletes a tracked test file and its companion source
- **THEN** the `pr-policy` check does not fail for that co-deletion alone

### Requirement: allowOnly and forbidOnly are ratcheted

Vitest configuration SHALL set `allowOnly: false`. Playwright configuration SHALL set `forbidOnly: true` (not only when CI is detected). The gate ratchet SHALL fail when head weakens either key relative to base (including changing `forbidOnly` from `true` to a CI-gated expression).

#### Scenario: forbidOnly false fails pr-policy

- **WHEN** a pull request sets Playwright `forbidOnly` to `false` (or a non-`true` value) relative to base `true`
- **THEN** the `pr-policy` check fails

#### Scenario: allowOnly true fails pr-policy

- **WHEN** a pull request sets Vitest `allowOnly` to `true` (or removes `false`) relative to base
- **THEN** the `pr-policy` check fails

### Requirement: ESLint forbids focused and skipped tests

`pnpm lint` SHALL error on focused tests, skipped/disabled tests, and conditional-in-test patterns in Vitest and Playwright files via exact-pinned `@vitest/eslint-plugin` (`no-focused-tests`, `no-disabled-tests`, `no-conditional-in-test`) and `eslint-plugin-playwright` (`no-focused-test`, `no-skipped-test`, `no-conditional-in-test`).

#### Scenario: Focused test fails lint

- **WHEN** a test file contains `test.only` / `it.only` / `describe.only`
- **THEN** `pnpm lint` fails

#### Scenario: Skipped test fails lint

- **WHEN** a test file contains `test.skip` / `it.skip` / `describe.skip`
- **THEN** `pnpm lint` fails

#### Scenario: Conditional in test fails lint

- **WHEN** a test body contains a conditional that the ESLint `no-conditional-in-test` rule flags
- **THEN** `pnpm lint` fails

### Requirement: Item done-criteria self-loosening fails pr-policy

In a pull request for roadmap item slug S, edits to `docs/roadmap/<milestone>/S.md` beyond checkbox ticks, `Status: done`, and a Done note SHALL fail `pr-policy` unless the PR body has `Owner-approved scope change: <link>`. A new roadmap item that names S or defers S's coverage/mutation/NoCoverage/e2e bar SHALL fail the same way. The workflow SHALL pass the PR body as `PR_POLICY_BODY` and re-run on body `edited`.

#### Scenario: Rewritten Done-when fails pr-policy

- **WHEN** a pull request rewrites its own item's Done-when lines without an `Owner-approved scope change:` line in the PR body
- **THEN** the `pr-policy` check fails

#### Scenario: Deferral roadmap item fails pr-policy

- **WHEN** a pull request adds a new roadmap item that names the current slug or defers its mutation/coverage/e2e bar, without owner approval in the PR body
- **THEN** the `pr-policy` check fails

#### Scenario: Checkbox ticks and Done note pass

- **WHEN** a pull request only ticks its item's Scope/Done-when boxes, sets `Status: done`, and adds a Done note
- **THEN** the `pr-policy` check does not fail for those item-file edits alone

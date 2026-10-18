## ADDED Requirements

### Requirement: Gate ratchet on pull requests

On every pull request, CI SHALL run a `pr-policy` job from a `pull_request_target` workflow that executes only the **base** ref’s workflow and `scripts/check-gate-ratchet.mjs`. The head commit SHALL be read only as git object data; head code MUST NOT be installed or executed. The check SHALL fail when the head tree is weaker than base per the ratchet rules. No label, input, or environment override SHALL disable the ratchet.

#### Scenario: Weaker coverage floor fails pr-policy

- **WHEN** a pull request lowers a numeric floor or target in `quality/gates.json` or `codecov.yml` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: New exclude pattern fails pr-policy

- **WHEN** a pull request adds a Stryker `mutate` `!` pattern, a Vitest coverage exclude, or a Codecov `ignore` pattern relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Removed coverage include fails pr-policy

- **WHEN** a pull request removes `scripts/agent.mjs` (or any other entry) from Vitest coverage `include` relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: New mutator exclusion fails pr-policy

- **WHEN** a pull request adds `mutator.excludedMutations` (or other weaker Stryker mutator options) relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: New ignore comment or Stryker disable fails pr-policy

- **WHEN** a pull request adds a `v8|istanbul|c8 ignore`, blanket `eslint-disable`, `@ts-ignore`, or any `Stryker disable` line relative to base
- **THEN** the `pr-policy` check fails

#### Scenario: Deleted ratchet rule fails pr-policy

- **WHEN** a pull request’s ratchet rule-id list is not a superset of base’s rule-id list
- **THEN** the `pr-policy` check fails

#### Scenario: Head workflow edit does not rejudge the PR

- **WHEN** a pull request edits `.github/workflows/pr-policy.yml` or `scripts/check-gate-ratchet.mjs` but does not weaken gate data relative to base
- **THEN** that pull request is still judged by the base ref’s workflow and script

### Requirement: Required-check gate steps stay binding

Versus base, a gate step (Playwright e2e or burn-in, Vitest coverage, Stryker, Lighthouse, gitleaks, or dependency audit) that ran inside a job listed in `quality/gates.json` `requiredCheckJobs` MUST NOT be removed, marked `continue-on-error`, or moved unless the required job `needs:` the new job and fails when it fails. Comparison SHALL be static YAML of workflow files.

#### Scenario: Burn-in moved without needs fails

- **WHEN** a pull request moves the burn-in step out of the `integration` job into a parallel job that `integration` does not `needs:`
- **THEN** the `pr-policy` check fails

#### Scenario: Burn-in moved with aggregating needs passes

- **WHEN** a pull request moves burn-in into a parallel job and the `integration` job `needs:` that job and fails when it fails
- **THEN** the `pr-policy` check does not fail for that move alone

### Requirement: Codecov YAML validity check

Local `pnpm check` (and the checks workflow) SHALL validate `codecov.yml` via Codecov’s validator (`POST https://api.codecov.io/validate`) and MUST fail unless the first line of the response body is exactly `Valid!` (a trailing normalized config dump is allowed). On a network error contacting that endpoint only, the check MAY fall back to a pinned allowlist of known top-level keys; a validation failure response MUST NOT use that fallback.

#### Scenario: Unknown top-level key fails check

- **WHEN** `codecov.yml` contains an unknown top-level key such as root-level `notify:` instead of `codecov: notify:`
- **THEN** `pnpm check` fails the codecov YAML validity step

#### Scenario: Main codecov.yml passes

- **WHEN** the committed repository `codecov.yml` is validated
- **THEN** the codecov YAML validity step passes

#### Scenario: Network error uses pinned key fallback only

- **WHEN** the Codecov validator endpoint cannot be reached due to a network error
- **THEN** the check applies the pinned top-level key allowlist and still fails on unknown keys

# Proposal

## Why

**Problem:** Diff mutation still uses nightly thresholds (break 60), always passes `--allowEmpty`, and never fails on NoCoverage. Excluded product files can change silently; agents ship PRs that look green while mutation is dishonest (issue #72 B, J; PR #71 / #82).

**Why now:** M2.1 review cut — after `gate-values-file`, `gate-ratchet`, `gate-weakening-guard`, and `stryker-disable-budget`, enforce honest diff mutation: break 85, zero NoCoverage, shrink-only temporary excludes.

## What Changes

- Diff thresholds `{ high: 90, low: 85, break: 85 }` in `quality/gates.json`; `stryker.diff.config.mjs` spreads nightly config; nightly keeps break 60. Ratchet: values only stricter; diff ≥ nightly.
- After the run, fail on any NoCoverage mutant in the mutation report; `stryker-pr-summary` lists them (file:line, mutator) and changed files not mutated.
- Product bang-excludes become `mutation.temporaryExcludes` (path + until-item); list can only shrink. Changed excluded file not on that list, or skip while a production file changed, fails with no override.
- Drop `--allowEmpty` when production files changed; update `ci-gates` "Empty mutate set".
- Prove Done-when with fixture reports/trees exercising real scripts (PR #71 / #82 / #70-like / docs-only).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ci-gates`: honest diff mutation (thresholds, NoCoverage fail, temporaryExcludes ratchet, allowEmpty / empty-set rules, summary listings).

## Impact

**Scope in:** `quality/gates.json`, `stryker.diff.config.mjs`, `stryker-diff.mjs`, load/ratchet/summary scripts + tests, `ci-gates` delta, mutate include for new helpers.

**Scope out:** Product UI; `exclusions-registry` YAML move; raising nightly break; GitHub required-check settings; package.json dependency changes.

**Success criteria:** Fixture: PR #71 numbers (85.4% with 18 NoCoverage) fail; PR #82 first round (72.49%, 3 NoCoverage) fail; a PR like #70 (only excluded files changed, not on the temporary list) fails; docs-only skips green. This PR's CI run observed.

**Risks:** `pull_request_target` / pr-policy stays base-exec / head-as-data; false skip if production classification is wrong (mitigate fixture + real script path).

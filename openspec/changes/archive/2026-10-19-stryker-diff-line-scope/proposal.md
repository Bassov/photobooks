# Proposal

## Why

`stryker-diff` mutates every changed production file as a whole. Touching a legacy file below 85% (comment-only or an unrelated one-line edit) fails the PR on mutants the PR never introduced (PR #92, #120 round 2). The gate should score only the lines the diff actually changes.

## What Changes

- Diff mutation derives per-file changed line ranges from git hunks vs the merge base and mutates/scores only those ranges.
- NoCoverage and the 85% break threshold apply only to mutants on those ranges.
- Deleted-only hunks and files with no mutable changed lines produce no mutants and do not fail.
- The gate report states which ranges were scored.
- Out of scope: nightly/full mutation, threshold values in `quality/gates.json`, Codecov, e2e, product app code.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: PR diff mutation SHALL limit mutate/score/NoCoverage to changed line ranges from the merge-base diff; empty mutable ranges skip without failure; the mutation report/summary SHALL list scored ranges.

## Impact

- `scripts/stryker-diff.mjs`, `scripts/stryker-diff-gate.mjs`, related unit tests, PR mutation summary / CI report section text as needed.
- Spec delta under `openspec/specs/ci-gates/` (including Honest diff mutation gate).
- No new dependencies; no app/UI; security surface N/A.

## Success criteria

- Comment-only edit, or edit on lines with no mutants, in a legacy file below 85%: gate passes (real fixtures through the real gate path).
- Changed line with NoCoverage, or changed-line score &lt;85%: gate fails (both tested).
- `quality/gates.json` thresholds unchanged; gate-ratchet green; diff coverage/mutation ≥85, 0 NoCoverage on this change.

## Risks

- Hunk parse under-mutate (false pass) or over-mutate (legacy whole-file pain returns) — table-driven + tmp-repo tests on the real gate helpers.
- Honest-gate carve-out for empty scored ranges / ranged `--allowEmpty` must not weaken break/NoCoverage on scored mutants or unauthorized-exclude.

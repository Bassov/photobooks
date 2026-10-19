# stryker-diff-line-scope

Tag: prep
Milestone: M2.1
Title: stryker-diff scores only changed lines
Status: done

## Scope

Why: the stryker-diff gate mutates whole changed files, so any touch (even a comment or an unrelated one-line edit) to a legacy file below 85% (e.g. scripts/agent.mjs ~79%) fails the PR on mutants the PR never touched. Evidence: PR #92, PR #120 round 2.
Scope:

- [x] the stryker-diff gate derives changed line ranges per changed file from the git diff hunks against the merge base and mutates/scores only those ranges (Stryker `mutate` entries with line ranges, e.g. `path:start-end`, or filtering the report to mutants on changed lines, whichever is exact)
- [x] NoCoverage and the 85% break threshold are evaluated only over mutants on changed lines
- [x] deleted-only hunks and files with no mutable changed lines produce no mutants and do not fail
- [x] the gate's report states which ranges were scored
      Done when:
- [x] a comment-only edit and an edit on lines with no mutants in a legacy file below 85% no longer fail the gate (tests from real fixtures through the real gate path)
- [x] a changed line with a NoCoverage mutant, or changed lines scoring <85%, still fail (tests for both)
- [x] no other gate weakened (thresholds in quality/gates.json unchanged, ratchet green); coverage/mutation >=85 on the diff, 0 NoCoverage
      Size: ~500.

## Done note

Diff mutation scores Stryker path:start-end ranges from merge-base hunks; NoCoverage/break on scored set only; empty ranges skip; summary lists ranges.

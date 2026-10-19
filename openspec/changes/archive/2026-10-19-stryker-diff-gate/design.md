# Design

## Context

Diff mutation always uses nightly thresholds (`break: 60`), always passes `--allowEmpty`, and exits 0 on an empty mutate set — including bang-excluded product changes. Summary counts NoCoverage but does not fail or list NoCoverage / unmutated files. Product bang-excludes are not a shrink-only allowlist. Ratchet already covers nightly `stryker.thresholds.*` and `mutation.disableBudget`.

## Goals / Non-Goals

**Goals:** Diff break 85 from gates + `stryker.diff.config.mjs`; fail on any report NoCoverage; temporaryExcludes ratchet with bootstrap; no silent skip / no `--allowEmpty` when production changed; summary lists NoCoverage + unmutated changed files; fixture proofs on real helpers; mutation ≥85% / 0 NoCoverage on touched helpers.

**Non-Goals:** `exclusions-registry` YAML; product UI; nightly break raise; new dependencies; parallel rule engine; GitHub required-check settings.

## Decisions

1. **Gates** — `stryker.diffThresholds: { high: 90, low: 85, break: 85 }`; nightly `stryker.thresholds` unchanged; `mutation.temporaryExcludes: [{ path, until }, …]` for the listed product bang-excludes. Validate in `load-gates.mjs` (include `disableBudget`).

2. **Diff config** — `stryker.diff.config.mjs` spreads nightly default and overrides `thresholds` from `diffThresholds`. Runner: `stryker run --config stryker.diff.config.mjs`.

3. **Ratchet** — Numeric `higher-stricter` for `diffThresholds.*`; fail if any head diff value < matching nightly; `temporaryExcludes` paths: if base has no array, allow the initial seed set; thereafter head path set ⊆ base (same bootstrap pattern as `e2e.flakySpecs`). New RULE_IDS/FIXTURE_IDS.

4. **`stryker-diff.mjs`** — Unauthorized exclude (bang-excluded production path ∉ temp list) fails. Empty mutate: skip only when no production-include candidate remains outside temp list. Omit `--allowEmpty` when any production candidate changed. After run: fail if the report has any NoCoverage (report-wide).

5. **Summary** — List each NoCoverage (`file:line`, mutator) and changed files with no report entry. Keep disables + Ignored.

6. **Proofs / tests** — Real helpers + fixture reports/file lists (Done-when cases in tasks). Clear ambient `GIT_*`; tmp repos only. New helpers in mutate include.

7. **Empty mutate scenario** — Skipped only after temp-exclude accounting; unauthorized exclude / production-skip fail the job.

## Security

- Diff job stays on `pull_request`. `pr-policy` remains base-exec / head-as-data.
- No new dependencies.

## Touch-set

| Path                                      | Reason                                  |
| ----------------------------------------- | --------------------------------------- |
| `quality/gates.json`                      | `diffThresholds` + `temporaryExcludes`  |
| `stryker.diff.config.mjs`                 | spread + diff thresholds                |
| `stryker.config.mjs`                      | mutate include for new helpers          |
| `scripts/load-gates.mjs` (+ test)         | validate new fields                     |
| `scripts/stryker-diff.mjs` (+ test)       | classify, allowEmpty, NoCoverage        |
| `scripts/stryker-pr-summary.mjs` (+ test) | NoCoverage + unmutated                  |
| `scripts/check-gate-ratchet.mjs` (+ test) | diff ≥ nightly; temp shrink + bootstrap |
| `openspec/specs/ci-gates/spec.md`         | archive sync                            |
| `openspec/changes/stryker-diff-gate/**`   | planning + delta                        |
| `docs/roadmap/M2.1/stryker-diff-gate.md`  | tick / Done note only                   |

## Risks / Trade-offs

- [Temp list vs bang drift] → assert every temp path has a matching `!` mutate entry.
- [NoCoverage with score ≥ break] → still fail (zero NoCoverage).

## Open Questions

N/A

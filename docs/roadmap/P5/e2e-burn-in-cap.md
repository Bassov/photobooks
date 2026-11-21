# e2e-burn-in-cap

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item e2e-burn-in-cap

`e2e-burn-in` must stay bounded when a PR edits a shared e2e fixture. PR #660 (edits `e2e/fixtures/coverage.ts`,
imported by every spec) made `ts-rig-gate e2e-burn-in-targets` select the whole suite: 1055 tests × 10 repeats on one
worker (~5.4 h); the job was cancelled twice at ~2 h. The fix lives in ts-agent-rig (`src/e2e-burn-in-targets.mjs`);
this item tracks it and the dependency bump that follows the rig release.

## Scope

- [x] Directly changed specs keep full burn-in (all repeats), as before.
- [x] Specs pulled in only through a changed non-spec e2e file are a deterministic sample that fits a test-run
      budget (`E2E_BURN_IN_BUDGET`, default 900 ≈ 30 min on one worker at ~30 tests/min) at the burn-in repeat count;
      at least one such spec is always kept (a fixture-only change is sampled, not skipped).
- [x] Output shape unchanged (newline list of spec paths); `.github/workflows/integration.yml` needs no change.
- [x] Rig unit tests: only spec changed → unchanged; fixture imported by all specs → bounded; mixed → spec plus a
      bounded sample; deterministic output.
- [x] #660's diff replayed: before 217 specs, 1055 × 10; after 27 specs, 87 × 10 = 870 test runs.
- [ ] Bump `@albasov/ts-agent-rig` to the release carrying the fix (orchestrator, after the rig release).
- **Browser check:** n/a (CI-only change).

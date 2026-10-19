# Design

## Context

On main after #126 (`498ec7f`): `scripts/script-include-ratchet.mjs` already provides `coverageIncludeCovered`, `isAllowedScriptPairedExclude`, `codecovFlagPathCovered`, and `compareScriptScopeGates` (wired from `compareGateTrees`). Codecov flag paths use prefix cover. Replaying real pre-#126 vs #126 configs already yields 0 violations for coverage/exclude/codecov. Missing: (a) Stryker **positive** mutate-entry subsumption, (b) a committed real-file fixture test, (c) compareGateTrees/cliRatchet proofs for every Scope (3) weakening. `pull_request_target` still executes base’s script; this PR’s HEAD checks prove the behavior that merges into base.

## Goals / Non-Goals

**Goals:**

- Mutate positive removal allowed only when a remaining head mutate glob covers the path (reuse `coverageIncludeCovered` / `hasScriptsCoverageInclude` — no second helper family)
- Frozen #126 base/head fixtures → `compareGateTrees` → 0 violations
- Real-path red tests for uncovered removal, broad exclude, non-thin CLI, uncovered Codecov drop
- FIXTURE_IDS entries so those proofs cannot be deleted silently

**Non-Goals:**

- Rewriting or duplicating thin-CLI detection (`foo.mjs` / `isThinDelegatingCli`)
- Changing coverage/mutation floors, Codecov targets, or other ratchet rules
- Making `pull_request_target` execute head code
- package.json / lockfile dependency changes; other-session file edits

## Decisions

1. **Reuse helpers** — Extend `compareScriptScopeGates` only: extract non-bang `mutate` entries via `extractStrykerGateBits` (add a `mutate` / positive list field) and apply `coverageIncludeCovered`. Same `include-removed` rule id; new MSGS prefix for mutate includes. Dropping `scripts/**/*.mjs` from mutate when base had it fails like coverage.

2. **Fixtures** — Commit real pre/post #126 gate file contents as one JSON blob `scripts/fixtures/pr-126-scripts-glob.json` (avoids knip/eslint treating copies as source). Tests read the blob; never `git show` / worktree ops against the repo under test.

3. **Weakening proofs** — Drive `compareGateTrees` (and at least one `cliRatchet` / `runPrPolicyCheck` where FIXTURE_IDS require it) with surgical head edits on top of a minimal or #126-derived base. Broad excludes: `!scripts/**` and `!src/**/*.ts` must fail `exclude-added`. Non-thin CLI and uncovered Codecov path likewise.

4. **Touch-set** — `scripts/script-include-ratchet.mjs` (+test), `scripts/check-gate-ratchet.mjs` (+test), `scripts/fixtures/pr-126-scripts-glob.json`, OpenSpec delta + roadmap item ticks. No `package.json`, no app `src/**`, no parallel-session paths.

5. **Already on main (do not re-land)** — Glob coverage include subsumption, paired `scripts/**/*.test.mjs` + thin-CLI excludes, Codecov `scripts/` prefix cover, `foo.mjs` thin-CLI helper, ci-gates scenarios for hand-list→glob coverage include.

## Risks / Trade-offs

- Mutate subsumption can fail PRs that shrink mutate without a covering glob — intended strengthening; #126 replay stays green.
- Large-ish fixture copies (~15KB) — acceptable vs git-in-test risk (PR #93).

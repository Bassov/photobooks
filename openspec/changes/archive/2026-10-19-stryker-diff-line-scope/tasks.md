# Tasks

## 1. Line-range helpers

- [x] 1.1 Add pure helpers in `stryker-diff-gate.mjs`: parse unified `-U0` hunks → per-file new-side ranges; merge overlapping/adjacent; format Stryker `path:start-end` specs; filter NoCoverage / score evaluation to scored ranges only
- [x] 1.2 Unit-test helpers table-driven (multi-hunk, delete-only, adjacent merge, empty) plus tmp-repo fixtures via `git-test-helper` (strip ambient `GIT_*`; never touch the real repo)

## 2. Wire the gate

- [x] 2.1 Update `stryker-diff.mjs` / `buildStrykerArgs` / `planDiffMutation` to collect ranges for in-scope changed files (working tree + cached + untracked whole-file), pass mutation ranges to Stryker, skip when no scored ranges, write/log scored specs to `mutate-files.txt`
- [x] 2.2 Extend `stryker-pr-summary` (and tests) so the mutation summary lists scored `path:start-end` ranges from the mutate list

## 3. Done-when tests

- [x] 3.1 Real-path tests: comment-only edit and non-mutable-line edit on a “legacy below 85%” fixture → gate plan/args produce empty or range-only mutate and NoCoverage/skip path does not fail; deleted-only → no ranges / no fail
- [x] 3.2 Real-path tests: NoCoverage on a scored changed line → `evaluateNoCoverageGate` fails; a scored mutant set whose score is below `stryker.diffThresholds.break` (from `quality/gates.json`, not lowered) → assert the gate/job fail outcome through the real helper or Stryker argv+threshold path (not a stub flag)

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (no UI)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced — N/A (no UI)
- [x] Docs/rules sync: roadmap item + openspec delta; no AGENTS/README changes required
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced; agent 92f35efb after Honest-gate + design 3 + scenario wording fixes)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass; agent f18a688f)
- [x] Manual check — N/A (non-UI prep; scenarios recorded below)
- [x] Security Review — N/A (CI scripts only; not security-tagged)

## Manual test scenarios

N/A — CI gate / scripts only; no UI Browser check on this [prep] item.

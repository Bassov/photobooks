# prepush-scoped-units

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item prepush-scoped-units

Process item P-20261105-1543-2. Pre-push (`ts-rig-ci hook-pre-push` → `pnpm check:integrity && pnpm check:fast`) runs the whole unit + property suite at full `numRuns` on a machine loaded by 3 workers + e2e (load 30+): it takes 222–274 s and fails on PBT timeouts in files the branch never touched (`buildSiteTree.pbt`, `EditorTopBar`), leaving commits unpushed (#440, #477, #481). CI runs the full suite on every push anyway.

## Scope

- [ ] Local `check:fast` unit step (the one pre-push runs) tests only the diff: `vitest --changed $(git merge-base HEAD origin/main)`; full run when the merge-base cannot be resolved.
- [ ] Vitest setup: property tests take a lower `numRuns` (25) in the scoped local run; CI keeps its current `numRuns`.
- [ ] `docs/roadmap/RULES.md` two-attempt push stop: a push failure in a file outside the diff is reported in the PR body; the next push is retried once with the scoped run.
- [ ] If the hook itself lives in `ts-agent-rig` and cannot be overridden from photobooks, say so in the PR and do the photobooks-side parts only.
- Off limits: product code in `src/` and `uikit/src`; `.github/workflows/checks.yml`.
- **Done when:** pre-push wall time p50 < 90 s with the other workers running (3 timed pushes, numbers in the PR body); a branch touching only `uikit/` runs 0 `src/**/*.pbt.test.ts` locally (shown in the PR); CI unit coverage and `numRuns` unchanged (diff of `.github/workflows/checks.yml` is empty).
- **Browser check:** N/A (local test tooling and docs only; no runtime behavior change).

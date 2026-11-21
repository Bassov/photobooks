# e2e-slow-tests

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item e2e-slow-tests
Status: done

## Scope

Owner 2026-11-21, after #652 (1h42m → 26m33s wall): find where the slowest e2e specs spend their time and make them faster without weakening what they check. Files: `e2e/kit-personal-site-reader-gl.spec.ts`, `e2e/site-reader-gl.spec.ts`, `e2e/filmstrip.spec.ts`, `e2e/multi-select.spec.ts`, `e2e/design-r2-layout-picker.spec.ts`, `e2e/library-screens.spec.ts` (1276 s of test time in run 44773461133) plus the helpers they use.

- [ ] Profile each file (per-test duration, what one slow test waits on) and fix the causes: real conditions instead of time, shared setup where tests do not mutate it, smaller fixtures, existing test/motion hooks, merged boots that keep every assertion.
- [ ] Product causes (slow GL ready, slow import) are findings in the PR body; fixed only if small and in lane, else follow-ups.
- [ ] `.github/e2e-shard-durations.json` refreshed for the changed files.
- **Done when:** the 6 files take ≥40 % less test time (≤765 s) in this PR's CI `e2e-results`, per-file before/after table in the PR body; no assertion removed or loosened, no timeout raised, no retry, skip or fixme added; test count unchanged or every merge/split explained; every changed spec green 3× locally (`--repeat-each=3`); PR body lists findings (cause → fix → seconds) and follow-up candidates (print-dialog, spread-view, filmstrip-stuck-thumbs, kit-personal-site, site-final, kit-pdf-export).
- **Browser check:** none (test-only change); the changed specs and the PR's CI `integration` run are the check.
- **UI kit:** none (no matching component)

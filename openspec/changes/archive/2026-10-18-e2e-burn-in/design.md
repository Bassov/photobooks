## Context

See proposal.md. Today `integration.yml` runs only `pnpm test:e2e` (CI retries=2, workers=1). CI report sections are `lighthouse | mutation | coverage` via `scripts/ci-report-comment.mjs` (pack → artifact → `ci-comment` job with `concurrency.group: ci-report-<pr>`). Playwright has no JSON reporter in CI. Diff selection for Stryker: `scripts/stryker-diff.mjs` / `mutation-scope.mjs`.

## Goals / Non-Goals

- **Goals:** Select burn-in targets; run burn-in with env/roadmap repeat count; Playwright JSON for main + burn-in; `e2e` CI report section (burn-in count + main-run flaky count); prove timing-dependent failure under burn-in policy; prove `Burn-in: 50` on this PR’s item drives CI repeats.
- **Non-Goals:** Zeroing main-run retries; `quality/gates.json`; fixing named flakes.

## Decisions

1. **Targets — `scripts/e2e-burn-in-targets.mjs`**  
   Public API: `selectBurnInTargets(changedPaths, io)` → sorted spec paths. Diff vs `origin/main` (same git pattern as stryker-diff). Include added/changed `e2e/**/*.spec.ts`; for changed e2e support files (`e2e/**/*.{ts,mts,js,mjs}` that are not `*.spec.ts`, including `e2e/fixtures/**` and `e2e/helpers/**`), resolve each spec's static relative imports to repo paths (extension/`index`) and include the spec when it imports a changed support file directly or transitively through other e2e files. `e2e/burn-in-fixtures/**` is excluded from targeting. CLI prints paths (one per line); empty → exit 0.

2. **Count — `scripts/e2e-burn-in-count.mjs`**  
   Public API: `resolveBurnInCount({ env, branch, readItemFile })` → integer. Base = `Number(E2E_BURN_IN)` or 10. Resolve `docs/roadmap/**/<slug>.md` from branch `feat|fix/<slug>`. If `Burn-in: N` and N > base, use N. CLI prints one integer.

3. **CI proof for Done-when (this PR)**  
   Set `Burn-in: 50` on `docs/roadmap/M2.1/e2e-burn-in.md`. Add a minimal `e2e/burn-in-smoke.spec.ts` (one fast, deterministic assertion) so this PR always has a burn-in target and CI runs `--repeat-each=50` on it. Keep the smoke as a cheap canary. Timing-dependent proof lives under `e2e/burn-in-fixtures/` (excluded from the default suite via `testIgnore` + dedicated Playwright config); exercise it with `buildBurnInArgs` (`--repeat-each=10 --retries=0 --workers=1`) outside `pnpm test:e2e`.

4. **Workflow**  
   PR: `fetch-depth: 0` → count + targets → burn-in Playwright when targets non-empty (`--repeat-each=$COUNT --retries=0 --workers=1` + JSON) → main `pnpm test:e2e` with JSON → pack `e2e` section → upload `ci-section-e2e`. Follow-on `ci-comment` job (mirrors checks.yml): download artifact, `apply --section e2e`, same `ci-report-<pr>` concurrency. **No in-job apply.** Push to main: skip burn-in; no e2e comment.

5. **Summary — `scripts/e2e-playwright-summary.mjs`**  
   Public API: `countFlakyRetriedPasses(json)`, `countFailedTests(json)`, `buildBurnInArgs({ targets, count })`, `formatE2eSectionMarkdown({ burnInCount, flakyCount, burnInOutcome, burnInFailedCount })`. Flaky = tests whose `results` has length > 1 and final status passed. Markdown two-column table for scoreboard including burn-in result when burn-in ran. Timing-fail proof: real Playwright on `e2e/burn-in-fixtures/` via dedicated config (not in default suite).

6. **CI report**  
   Add `e2e` to `SECTIONS`, `SECTION_TITLES`, `DETAILS_SUMMARY`, and `emptyState().sections`. Tests extend `scripts/ci-report-comment.test.mjs`.

7. **Tests**  
   Reuse vitest style of `scripts/ci-report-comment.test.mjs` / `scripts/mutation-scope.test.mjs`. Cover: target selector (spec change, fixture/nested/transitive importer, same-leaf non-match, deleted support, empty); count (`E2E_BURN_IN`, `Burn-in: 50` override, `Burn-in: 0`, missing item); flaky/failed counters + markdown + `buildBurnInArgs`; `e2e` section render; scripts in coverage/mutation scope.

## Touch-set

| Path                                               | Reason                                               |
| -------------------------------------------------- | ---------------------------------------------------- |
| `.github/workflows/integration.yml`                | burn-in, JSON, pack + `ci-comment` (**gate-config**) |
| `playwright.config.ts`                             | CI JSON reporter if not only CLI                     |
| `scripts/e2e-burn-in-targets.mjs` + `.test.mjs`    | select targets (support-file graph)                  |
| `scripts/e2e-burn-in-count.mjs` + `.test.mjs`      | count resolver                                       |
| `scripts/e2e-playwright-summary.mjs` + `.test.mjs` | flaky/burn-in markdown + buildBurnInArgs             |
| `e2e/burn-in-fixtures/` + proof config             | timing-dependent burn-in proof (not default suite)   |
| `vite.config.ts` / `stryker.config.json` / codecov | include the three new scripts in coverage/mutation   |
| `scripts/ci-report-comment.mjs` + `.test.mjs`      | `e2e` section + emptyState                           |
| `e2e/burn-in-smoke.spec.ts`                        | CI burn-in target for this PR                        |
| `docs/roadmap/M2.1/e2e-burn-in.md`                 | `Burn-in: 50` + tick scope                           |
| `openspec/specs/ci-gates/spec.md`                  | archive sync                                         |

## Risks / Trade-offs

- [Long CI] → one smoke + changed specs only; workers=1.
- [Dynamic imports missed] → static scan only; acceptable.
- [Branch ≠ slug] → fall back to `E2E_BURN_IN` only.

## Open Questions

_(none)_

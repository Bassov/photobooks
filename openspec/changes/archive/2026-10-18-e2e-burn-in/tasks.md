## 1. Burn-in target and count scripts

- [x] 1.1 Add `scripts/e2e-burn-in-targets.mjs` (`selectBurnInTargets`) + `scripts/e2e-burn-in-targets.test.mjs` — changed specs, helper importers, empty set
- [x] 1.2 Add `scripts/e2e-burn-in-count.mjs` (`resolveBurnInCount`) + `scripts/e2e-burn-in-count.test.mjs` — `E2E_BURN_IN` default 10, `Burn-in: N` override from roadmap item by branch slug

## 2. Playwright summary and CI report section

- [x] 2.1 Add `scripts/e2e-playwright-summary.mjs` (`countFlakyRetriedPasses`, `formatE2eSectionMarkdown`) + tests including timing-dependent harness that fails under `--repeat-each` + `--retries=0`
- [x] 2.2 Extend `scripts/ci-report-comment.mjs` with `e2e` in `SECTIONS`, titles, `DETAILS_SUMMARY`, and `emptyState`; update `scripts/ci-report-comment.test.mjs`

## 3. Integration workflow and CI proof assets

- [x] 3.1 Update `.github/workflows/integration.yml`: fetch-depth 0 on PRs; burn-in step; main e2e with JSON; pack `e2e` section; `ci-comment` job with shared concurrency (no in-job apply). Set `E2E_BURN_IN: '10'`
- [x] 3.2 Add `e2e/burn-in-smoke.spec.ts` (fast deterministic canary). Set `Burn-in: 50` on `docs/roadmap/M2.1/e2e-burn-in.md` and tick scope checkboxes as work lands
- [x] 3.3 Ensure Playwright CI produces JSON report path(s) consumed by the summary script (`playwright.config.ts` and/or CLI reporters)

## 4. Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff — no mutable `src/` files vs origin/main; skipped
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (CI tooling only)
- [x] UI in scope: browser smoke evidenced — N/A (prep / non-UI)
- [x] Docs/rules sync: roadmap item updated (`Burn-in: 50`, scope ticked); no AGENTS/README command map change required beyond CI behavior in specs
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass after burn-in PATH + legacy e2e section normalize)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: N/A (not security-tagged; no security surface)

## Manual test scenarios

N/A for UI (prep / CI tooling). Prep scenario checks:

1. `GITHUB_HEAD_REF=feat/e2e-burn-in node scripts/e2e-burn-in-count.mjs` → `50` (Burn-in override).
2. `STRYKER_DIFF_BASE=origin/main node scripts/e2e-burn-in-targets.mjs` → includes `e2e/burn-in-smoke.spec.ts`.
3. Timing harness: `node scripts/e2e-playwright-summary.mjs burn-in-harness --repeat-each 10 --retries 0` → non-zero exit (unit-covered).
4. `pnpm test:e2e:quiet` → green (known unrelated flaky on retry out of scope).

# lint-no-wait-for-timeout

Tag: lite
Milestone: P4
Title: Bug: /next-roadmap-item lint-no-wait-for-timeout

Process item P-20261115-0213-2 (self-improve retro, lane process). Why: `page.waitForTimeout` was banned only in reviewer prose, so workers learned about it a whole CI + review cycle late (#594, #612 RESUMEd for it alone; #580 let it through).

## Scope

- [x] `eslint.config.js` e2e block: `'playwright/no-wait-for-timeout': 'error'`, so `pnpm check:fast` (loop A) catches a sleep.
- [x] Replace the 45 calls in 23 e2e files: perf gesture pacing and LoAF-tail settles wait rendered frames (`waitFrames` in `e2e/perf/perfFixture.ts`); camera zoom settles poll for an idle, stable camera (`settleCamera` in `e2e/fixtures/dispatchCtrlWheel.ts`); the filmstrip coverage check polls; the site room open settle uses `page.clock`. No assertion loosened; no file-wide disable.
- Hard nos: no `docs/agent-loop.md` edit (the loop A line is proposed in the PR body); no `src/` change.
- **Done when:** `pnpm lint` green with the rule at error and every remaining disable has a reason (count in the PR body, target ≤10); adding `await page.waitForTimeout(100)` to a spec makes `pnpm check:fast` fail (shown in the PR body); `pnpm test:e2e:changed:quiet` on the changed specs: 0 unexpected.
- **Browser check:** N/A (e2e tests and lint config; no product code).

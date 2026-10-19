# Tasks

## 1. Detectors and ratchet rules

- [x] 1.1 Extend `scripts/check-gate-ratchet.mjs` (+ CLI): TypeScript-AST inventory + skip/focus/todo/fixme/fail/only + retries; title/body-hash + co-deletion companion; allowOnly/forbidOnly; item-criteria + `--pr-body`/`PR_POLICY_BODY`; new `RULE_IDS`/`FIXTURE_IDS`
- [x] 1.2 Set Vitest `allowOnly: false` and Playwright `forbidOnly: true`; wire into `compareGateTrees`; update `.github/workflows/pr-policy.yml` (`PR_POLICY_BODY`, `edited` type)

## 2. ESLint plugins

- [x] 2.1 Exact-pin `@vitest/eslint-plugin` + `eslint-plugin-playwright`; configure vitest `no-focused-tests`/`no-disabled-tests`/`no-conditional-in-test` and playwright `no-focused-test`/`no-skipped-test`/`no-conditional-in-test` as errors; run `pnpm audit:ci`

## 3. Fixture and real-repo proofs

- [x] 3.1 Fixture CLI proofs: `.skip`, `test.fixme`, `retries: 3`, deleted title, `forbidOnly: false`, `allowOnly: true`, file-alone delete, Done-when rewrite/deferral fail; rename+hash, file+companion, checkbox+Done note pass
- [x] 3.2 Unit test: inventory/skip detectors over real repo test files (non-empty); apply `ci-gates` delta; tick roadmap scope when delivered

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below) — observed: all OK including typecheck, pr-policy, lint, unit
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — observed: `OK e2e-changed (60.0s)` after evaluate helper fix
- [x] pnpm stryker:diff — observed: `OK stryker-diff (373.4s)`
- [x] pnpm test:lhci when UI or bundle size is affected — N/A non-UI
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A non-UI
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — observed: `No known vulnerabilities found` after `@vitest/eslint-plugin@1.6.27` + `eslint-plugin-playwright@2.12.1`
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — Verdict: pass (delta re-review)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — delta re-review: evaluate helpers + e2e OK; remaining notes were stale tasks ticks + touch-set (fixed)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — no medium/high/critical; base-only exec preserved; audit clean

## Manual test scenarios

(N/A — non-UI prep; proofs are fixture CLI tests + `pnpm check` / CI)

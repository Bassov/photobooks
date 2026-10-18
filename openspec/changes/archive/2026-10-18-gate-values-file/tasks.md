# Tasks

## 1. Gates file and loader

- [x] 1.1 Add `quality/gates.json` with exact main values (coverage 80×4, Stryker 80/60/60, LHCI runs/assertions, budget array, Playwright retries 0 + flakyRetries 2, burnInDefault 10, flakySpecs `[]`) and `scripts/load-gates.mjs` that validates required keys; verify `scripts/load-gates.test.mjs` covers happy path + missing/invalid keys

## 2. Wire consumers

- [x] 2.1 Point `vite.config.ts`, new `stryker.config.mjs` (delete `stryker.config.json`), `lighthouserc.mjs` (delete `.cjs`), `playwright.config.ts`, `e2e-burn-in-count.mjs`, and `e2e-flaky-list.mjs` at `load-gates`; keep `budget.json` / `e2e/flaky.json` as deep-equal mirrors; update `mutation-scope` / `stryker.mutate.md` / `package.json` / `knip.json` for `.mjs`; drop workflow hardcoded `E2E_BURN_IN: '10'`; verify existing burn-in/flaky unit tests still pass with gates defaults

## 3. Static check

- [x] 3.1 Add `scripts/check-gate-values.mjs` (+ tests) for mirror deep-equality, consumer presence of `load-gates`/`quality/gates.json`, absence of prior hardcoded gate literals, and workflow absence of hardcoded `E2E_BURN_IN: '<n>'`; wire into `pnpm check` via `package.json` + `CORE_CHECKS`; verify the check fails on a diverged mirror fixture and passes on the landed tree

## 4. Roadmap scope

- [x] 4.1 Tick Scope checkboxes in `docs/roadmap/M2.1/gate-values-file.md` only when each is fully delivered; verify Done-when wording matches the landed SoT + static check

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

N/A — non-UI prep (gate values file + static check); proof is `pnpm check` + CI head thresholds matching main.

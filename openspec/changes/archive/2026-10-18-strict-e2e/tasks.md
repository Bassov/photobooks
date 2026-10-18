# Tasks

## 1. Zero-retry Playwright config

- [x] 1.1 Set `playwright.config.ts` CI retries to 0, `trace: 'retain-on-failure'`, read `e2e/flaky.json` (commit `[]`), wire default-project `testIgnore` + project `flaky` with retries 2 — verify config loads and `rg 'retries:\\s*[1-9]' playwright.config.ts e2e/` finds no main-suite overrides
- [x] 1.2 Remove every `test.describe.configure({ retries })` from `e2e/drag-swap.spec.ts`, `e2e/drag-place.spec.ts`, `e2e/filmstrip.spec.ts`, `e2e/spread-view.spec.ts` — verify no remaining configure retries in those files

## 2. Flaky job, burn-in exclude, CI report

- [x] 2.1 Add `e2e-flaky` job to `.github/workflows/integration.yml` (runs only when `e2e/flaky.json` non-empty); extend `integration` needs + Require for `success|skipped` on `e2e-flaky` — verify YAML references project `flaky` and does not `continue-on-error`
- [x] 2.2 Exclude `e2e/flaky.json` paths from burn-in target selection; add unit coverage for empty/non-empty cases — verify targeted tests pass
- [x] 2.3 Extend `scripts/e2e-playwright-summary.mjs` (+ `.test.mjs`) with `@flaky list` row from JSON length — verify unit tests pass including count 0

## 3. Concrete swap/move asserts + skill

- [x] 3.1 Rewrite keyboard move assertions in `e2e/drag-swap.spec.ts` to check `data-asset-id` per frame (reuse existing fixtures); keep swap identity asserts — verify with targeted e2e once green
- [x] 3.2 Update `.cursor/skills/write-tests/SKILL.md` E2E section to require concrete asset-in-frame outcomes — verify skill text matches the agent-context delta

## 4. Roadmap scope + follow-ups

- [x] 4.1 If any path lands in `e2e/flaky.json`, run `pnpm roadmap add … --after strict-e2e` with a fix checkbox per entry; otherwise keep `[]` — verify Done-when `@flaky` count rule
- [x] 4.2 Tick Scope checkboxes in `docs/roadmap/M2.1/strict-e2e.md` only when delivered — verify item file matches shipped behavior

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI/bundle change)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass (N/A — non-UI gate)
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no lockfile/deps)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

(N/A — non-UI gate tooling; no Browser check on the roadmap item.)

## Notes

- `e2e/flaky.json` remains `[]`; no follow-up flaky-fix items added.
- Full `pnpm test:e2e` path: 62/62 with `--project=chromium --workers=1` after bulk-import switched to `photo-file-input` setInputFiles (filechooser hung headless).
- `e2e-changed-quiet` / `test:e2e` pin `--workers=1` (CI parity under zero retries).
- LHCI / UI smoke / audit: N/A (no UI product surface, no lockfile deps).
- stryker:diff: OK (no production `src/` mutants in this gate-only change).
- playwright.config inlines flaky.json parse (mirrors `e2e-flaky-list.mjs`); scripts SoT stays the mjs helper — TS node project cannot type-import repo `.mjs` without widening includes.

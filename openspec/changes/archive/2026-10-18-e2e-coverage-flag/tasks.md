# Tasks

## 1. Dependencies and ignore

- [x] 1.1 Add exact-pinned `vite-plugin-istanbul@9.0.1` and `nyc@18.0.0`; update lockfile. Add `coverage-e2e/` and `.nyc_output/` to `.gitignore`. Run `pnpm audit:ci`.

## 2. Instrumentation

- [x] 2.1 Share Vitest coverage exclude globs from `vite.config.ts`; when `VITE_COVERAGE=1`, enable Istanbul (`forceBuildInstrument`, sourcemaps) with those excludes plus `*.worker.ts`. Verify a normal `pnpm build` has no `__coverage__` / Istanbul markers in `dist`.
- [x] 2.2 Set Playwright `webServer` to set `VITE_COVERAGE=1` when `E2E_COVERAGE=1`.

## 3. Collect and merge e2e coverage

- [x] 3.1 Add `e2e/fixtures/coverage.ts` (`test.extend` auto fixture dumping `window.__coverage__` to `.nyc_output/`). Point every e2e spec (incl. burn-in) at its `test`/`expect`.
- [x] 3.2 Add `scripts/merge-e2e-coverage.mjs` (+ package script) to produce `coverage-e2e/lcov.info` via `nyc`. Smoke: one local instrumented e2e run yields non-empty lcov mapping to `src/**` and omitting workers.

## 4. Codecov + CI + spec sync

- [x] 4.1 Update `codecov.yml` (`flags.e2e` carryforward, `codecov.notify.after_n_builds: 2` + `wait_for_ci: true`). In `integration.yml`: uninstrumented e2e gate, then `E2E_COVERAGE=1` harvest (`--grep-invert` frame-budget), merge, upload `flags: e2e` with `fail_ci_if_error` + `disable_search` when token present. Sync `ci-gates` main spec. Tick roadmap Scope boxes when delivered.

## 5. Verification

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

Notes: e2e via `pnpm test:e2e:changed:quiet` (green after one frame-budget flake rerun). `stryker:diff` OK / no mutate targets. lhci / ui-review N/A (non-UI). README CI line updated; AGENTS.md / openspec/config.yaml / `.cursor/*` / `scripts/agent.mjs` intentionally untouched (parallel `agent-cost-cuts`). Design reviewer pass; implementation reviewer findings fixed (merge-gated upload, tasks ticks, README); Security Review pass.

## Manual test scenarios

N/A for UI ([prep] CI/tooling). Local + process evidence:

1. **Uninstrumented build:** `pnpm build` → no `__coverage__` in `dist/`.
2. **Instrumented harvest:** `E2E_COVERAGE=1` smoke → `.nyc_output` dump → `pnpm coverage:e2e` → `coverage-e2e/lcov.info` with `SF:src/…`, no worker paths.
3. **audit:ci:** clean (prod).
4. **Done-when (CI on this PR head — agent does not watch):** reviewer confirms Codecov comment shows `unit` and `e2e` separately; e2e-only lines count for `codecov/patch`; failed e2e upload fails `integration`; e2e-only coverage still yields NoCoverage in `stryker-diff`. Local claims are not Done-when proof.

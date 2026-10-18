# Tasks

## 1. Controller module

- [x] 1.1 Add `src/editor/session/autosaveController.ts` with `createAutosaveController`: timer arm/cancel, gesture gate, savePhase API (`beginSaving` / `ensureSaving` / `completeSavingIfSaving` / `settleAfterPersist` / `failSaving` / `markPendingFromError` / `reset` / `getSavePhase`), and `waitForPendingHashes` (single hash-wait seam)
- [x] 1.2 Add `src/editor/session/autosaveController.test.ts` covering debounce fire, cancel/re-arm, gesture gate, phase helpers, and hash-wait ordering via injected timers + stub hash waiter / `isGestureActive` only

## 2. Session delegation

- [x] 2.1 Wire `projectSession.ts` to own one controller instance; replace inline timer/phase/`awaitPendingHashes` in `persistBookSnapshot` with controller calls; no direct `savePhase =` left in session
- [x] 2.2 Confirm existing `projectSession.test.ts` autosave/integration cases still pass unchanged (do not move the file)

## 3. Roadmap scope

- [x] 3.1 Tick Scope checkboxes in `docs/roadmap/M2.1/autosave-controller.md` when delivered

## 4. Verification gates

- [x] 4.1 `pnpm check` (OK lines only) + targeted vitest for controller and `projectSession` suites; `pnpm stryker:diff` on the new module ≥85 with zero NoCoverage — observed `Final mutation score of 100.00`, 89/89 killed, 0 NoCoverage (no equivalents)

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A ([prep] extract; no UI change; e2e specs untouched)
- [x] pnpm stryker:diff — 100.00 on `autosaveController.ts`, 0 NoCoverage
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (no UI)
- [x] Docs/rules sync: no behavior/commands/CI/module-map change requiring README/AGENTS/rules updates; roadmap scope ticked in item file
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency or security-tagged item)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass; ticked checklist + removed unused module-level `timers`
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; unit + integration cover autosave scenarios
- [x] Security Review: N/A — item not security-tagged; no new FSA/picker/permission surface (hash-wait relocate only; behaviour unchanged)

## Manual test scenarios

N/A — non-UI [prep] extract. Covered by `autosaveController.test.ts` and existing `projectSession.test.ts` autosave / permissions suites (green locally).

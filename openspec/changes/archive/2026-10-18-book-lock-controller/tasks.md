# Tasks

## 1. Controller module

- [x] 1.1 Add `src/editor/session/bookLockController.ts` with `createBookLockController`: take/release (verbatim guards), locked-elsewhere enter, clearDocumentWhileLocked, regrant/regrantWithHandle, setPendingRegrant / clearBlockedAndPending / holdExternalBookLock, getters — verify TypeScript compiles against injected deps
- [x] 1.2 Add `src/editor/session/bookLockController.test.ts` covering acquire, second-tab locked-elsewhere, release then re-acquire, release host cancel/epoch guards, and re-grant granted/denied/picker+sameEntry/mid-session via injected lock fake + `createFakeBrowserDirectory` / permission+picker — verify vitest green

## 2. Session delegation

- [x] 2.1 Wire `projectSession.ts` to own one controller instance; replace inline lock/re-grant state and the five moved functions with controller calls including setters/seams; leave autosaveController untouched — verify no direct heldBookLock/blockedBookId/pendingRegrant writes remain
- [x] 2.2 Confirm existing `projectSession.test.ts` permissions/locks cases still pass unchanged (do not move the file) — verify vitest green

## 3. Roadmap scope

- [x] 3.1 Tick Scope checkboxes in `docs/roadmap/M2.1/book-lock-controller.md` when delivered

## 4. Verification gates

- [x] 4.1 `pnpm check` (OK lines only) + targeted vitest for controller and `projectSession` suites; `pnpm stryker:diff` on the new module ≥85 with zero NoCoverage — observed `Final mutation score of 94.48`, 171 killed, 0 NoCoverage; 10 survivors listed below

### Stryker survivors (equivalent / host side-effects already true)

- `setStorage` / `setLibraryId` no-ops mid-session when id/storage already match the remembered values (host state unchanged)
- `bookToOpen && storageAfterBind && getBookId() !== bookToOpen` boolean algebra mutants that still take the same branch under current fixtures
- `if (targetLibraryId)` / `if (peeked.ok)` → `true` when tests always supply a target or successful peek before the denied/unavailable branches
- leading `setHomeError(null)` in `regrantLibrary` when the next branch immediately overwrites homeError

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — `pnpm test:e2e:changed:quiet` OK (no changed e2e specs; permissions-locks untouched)
- [x] pnpm stryker:diff — 94.48 on `bookLockController.ts`, 0 NoCoverage
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced; skill `ui-review` pass — N/A (no UI)
- [x] Docs/rules sync: no behavior/commands/CI/module-map change requiring README/AGENTS/rules updates; roadmap scope ticked in item file
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency or security-tagged item)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass; removed unused `dropHeldLockRefs`
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; unit + integration cover lock/re-grant scenarios
- [x] Security Review: N/A — item not security-tagged; no new FSA/picker/permission surface (extract only; behaviour unchanged)

## Manual test scenarios

N/A — non-UI [prep] extract. Covered by `bookLockController.test.ts` and existing `projectSession.test.ts` permissions/locks suites. E2e `permissions-locks.spec.ts` unchanged (CI / changed-quiet).

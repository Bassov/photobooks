# Tasks

## 1. Activation module

- [x] 1.1 Add `src/editor/session/libraryActivation.ts` with `createLibraryActivation`: create/open/bind/activate/adopt/releaseOpenBookForNewLibrary/bookHasContent (and recents/restore if under budget) — verbatim guards; host by category — verify TypeScript compiles against injected host
- [x] 1.2 Add `src/editor/session/libraryActivation.test.ts` with named PR #71 data-loss cases (switch never writes previous book into new library; New library keeps unsaved edits / starts clean; picker cancel and permission denied leave state unchanged) plus create/open/adopt/open-empty guards via host fakes + memory storage/session + `createFakeBrowserDirectory` — verify vitest green

## 2. Session delegation

- [x] 2.1 Wire `projectSession.ts` to own one activation instance; replace moved functions with thin delegates; leave `autosaveController` / `bookLockController` untouched — verify no duplicate inline create/open/bind/adopt/(recents) bodies remain
- [x] 2.2 Confirm existing `projectSession.test.ts` library/recents/merge-blocker cases still pass unchanged (do not move the file) — verify vitest green

## 3. Roadmap scope

- [x] 3.1 Tick Scope checkboxes in `docs/roadmap/M2.1/library-activation.md` when delivered; if recents/restore deferred, `pnpm roadmap add` per growth rule and note in item — growth not needed (full create/open/adopt/switch/recents-restore shipped)

## 4. Verification gates

- [x] 4.1 `pnpm check` (OK lines only) + targeted vitest for activation and `projectSession` suites; `pnpm stryker:diff` on the new module ≥85 with zero NoCoverage — observed `Final mutation score of 92.59`, 475 killed, 0 NoCoverage; 38 survivors listed below. Unit coverage on `libraryActivation.ts`: lines/branches/functions/statements 100%.

### Stryker survivors (equivalent / host side-effects already true)

- `setStatus` on listBooks failure immediately overwritten by bindLibrary fail `setStatus`
- default `mode` `'adopt'` → `""` still takes the adopt path (`!== 'open'`)
- redundant `persistIds` / `setBookId(null)` / storage clears when state already null
- `releaseOpenBookForNewLibrary` clears before bind re-sets storage/ids/dirty/autosave
- leading `setHomeError(null)` when homeError already null
- openBookFromHome / clearStaleRestoreState repeated clear/persist/dirty/autosave after prior clears
- extra `emit()` calls where another emit in the same flow remains
- `preferredLibraryId` catch when value already null from arrange
- storage null/set pairs equivalent to neighbouring rollback/restore clears

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — `pnpm test:e2e:changed:quiet` OK (no changed e2e specs; library/recents/permissions untouched)
- [x] pnpm stryker:diff — 92.59 on `libraryActivation.ts`, 0 NoCoverage
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (no UI)
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another — roadmap scope ticked; no README/AGENTS/rules change required (extract only)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency or security-tagged item)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (low: redundant emit on openBookFromHome success; state unchanged; left as-is)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; unit + integration cover library/recents scenarios
- [x] Security Review: N/A — item not security-tagged; no new FSA/picker/permission surface (extract only; behaviour unchanged)

## Manual test scenarios

N/A — non-UI [prep] extract. Covered by `libraryActivation.test.ts` and existing `projectSession.test.ts` library/recents suites. Library/recents/permissions e2e unchanged (CI / changed-quiet).

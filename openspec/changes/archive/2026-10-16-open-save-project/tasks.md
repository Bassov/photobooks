# Tasks

## 1. Project session orchestration

- [x] 1.1 Add `src/editor/projectSession.ts` (create/open library, create book, saveBook scheduled off gesture path, tryRestore) over injectable LibraryStorage + SessionState; persist `libraryId`/`activeBookId` in sessionStorage — verify unit tests with memory adapters cover create → save → restore document and typed save failures

## 2. Library picker + chrome

- [x] 2.1 Add library directory picker helper + EditorShell chrome (Create/Open library, Create book, Save) and non-blocking status for typed failures; `data-testid` seam for tests — verify unit/component or e2e empty chrome shows create/open and viewport containment helpers still apply

## 3. bookStore load + keyboard save

- [x] 3.1 Wire bookStore replace/load for library-backed books; Ctrl/Cmd+S and Save action call projectSession.saveBook — verify unit tests for replace + shortcut wiring (or e2e save)

## 4. Library-backed import identity

- [x] 4.1 When library-backed, import registers AssetSource roots and writes `sourceRootId`/`relativePath`/size/mtime; enqueue existing hash worker for `contentHash`; session-only import unchanged without library — verify unit tests for identity fields with/without library (memory AssetSource this change; FSA photo-folder handles deferred)

## 5. Restore on boot + DerivedCache hydrate

- [x] 5.1 On boot call tryRestore when handle granted; ensureThumb/tiers use saved hashes — verify unit or e2e: reload restores gallery ids + placements; hashed thumb hydrate path covered

## 6. E2E open/save

- [x] 6.1 Playwright: empty chrome; happy save → reload → restore (injected seam); `assertDocumentFitsViewport` + `assertNamedScrollport` (pasteboard) — verify `pnpm test:e2e` covers these (typed save failure covered by unit test)

## 7. Perf save-during-drag

- [x] 7.1 Add throttled save-during-drag scenario to CI/`pnpm perf` per frame-budget delta — verify scenario is registered and fails on LoAF

## 8. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (592+ tests)
- [x] pnpm test:e2e (or pnpm verify) — green (41 passed incl. open-save + save-during-drag)
- [x] pnpm stryker:diff — 61.96% (≥ break 60; 483 killed / 17 timeout / 190 survived / 117 no-cov). Remaining: bookStore pre-existing flush/paint branches outside `patchAssetRecord`; importPhotos decode/error paths equivalent under existing batch tests; projectSession default FSA/FileSystemDirectoryHandle branch no-cov in unit env (e2e uses OPFS/`createStorage` inject); `scheduleBackground` idle fallback vs `postTask`; status string literals with overlapping assertions; `importRunning: false` on restore equivalent under empty meta; EditorShell excluded (thin chrome; e2e locked)
- [x] pnpm test:lhci when UI or bundle size is affected — green
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty: create/open visible, create-book/save disabled; happy: create book → import → save → reload restore; interact: save-during-drag LoAF gate; layout smoke: `assertDocumentFitsViewport` + pasteboard `assertNamedScrollport`; a11y: labeled actions + disabled states + polite status; anti-slop: existing brand chrome unchanged
- [x] Docs/rules sync: `AGENTS.md` projectSession note; `docs/future-architecture.md` open/save wiring; `stryker.mutate.md` EditorShell exclude; roadmap tick at archive
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (FSA security surface)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 49c197e9)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: c140b1f7 pass)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: dc3160c3 — no medium+ findings)

## Manual test scenarios

1. Open `http://127.0.0.1:5173/?testLibrary=1` — Create/Open library visible; after OPFS attach, Create book enables; Save stays disabled until a book exists.
2. Click Create book — polite status "Book created"; Save enables; `__photobooksProject.getSnapshot()` shows libraryOpen + bookId.
3. Playwright `e2e/open-save.spec.ts` (locked Browser check): create book → import two fixtures → Save → reload → status "Book restored", same gallery count; `assertDocumentFitsViewport` + pasteboard `assertNamedScrollport`.
4. Playwright save-during-drag frame-budget gate — zero LoAF while Save runs mid-drag.

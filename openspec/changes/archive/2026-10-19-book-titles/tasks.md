# Tasks

## 1. Domain helpers

- [x] 1.1 Add `displayBookTitle` (empty/whitespace → `"Untitled book"`) and `setTitle` BookOp; unit tests for helper + op
- [x] 1.2 Thread optional title into `createEmptyLibraryBook` / `createBookInLibrary`; widen home `selectRecentLibrary` to `BookSummary`

## 2. UI

- [x] 2.1 Home: list display titles; Rename control; create/rename prompts wired to session APIs
- [x] 2.2 Editor chrome: show display title + Rename; New book asks for title (cancel = no create)

## 3. Tests & roadmap

- [x] 3.1 Unit/component coverage for create-with-title, rename home/editor, cancel paths, Untitled fallback
- [x] 3.2 E2e: create → rename → reload/reopen persists; home shows titles; rename-while-filmstrip-scroll zero LoAF
- [x] 3.3 Tick Scope boxes in `docs/roadmap/M2.2/book-titles.md` when delivered; `ui-review` on home + chrome title UX

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (LHCI:0; budgets pass for `/` and `/uikit/`)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

1. Empty home: open `/` with no in-tab book → home empty copy + library actions; no page-level scroll (`assertDocumentFitsViewport`). Observed via `e2e/recents-home.spec.ts` / `e2e/open-save.spec.ts` empty-home cases (unchanged scrollport); book-titles e2e covers titled/Untitled list paths.
2. Create with title: attach library, create `"Summer"` → chrome `data-testid=book-title` shows Summer. Observed: e2e create/rename/reload test.
3. Rename from editor then home: rename to Trip, go home → list shows Trip not id; rename to HomeRename → persists across reload/reopen. Observed: same e2e.
4. Untitled fallback: create with empty title → chrome and home show `"Untitled book"`; stored title remains `""`. Observed: empty-title e2e.
5. Cancel create/rename: dismiss dialogs → title and active book id unchanged. Observed: cancel e2e.
6. Perf: rename while filmstrip scrolls → zero LoAF for rename-during-scroll window. Observed: frame-budget e2e in `e2e/book-titles.spec.ts`.

## ui-review

Pass on home books list + editor chrome title (2026-10-19):

- A11y: Rename controls have `aria-label`; focus styles reuse existing list/action patterns; no color-only status.
- States: Rename/New book disabled while busy/locked; Untitled empty path covered.
- Layout smoke: empty home + titled list + filmstrip scroll during rename — viewport contained; no new scrollports.
- Anti-slop: title uses existing `--font-body` chrome styling; no new card/hero chrome.

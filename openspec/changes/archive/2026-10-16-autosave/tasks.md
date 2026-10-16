# Tasks

## 1. Gesture seam

- [x] 1.1 Add `src/editor/editorGesture.ts` with `setEditorGestureActive` / `isEditorGestureActive` / `installDocumentDragGesture`; wire camera zoom/pan; verify unit tests for the flag, document drag install, and cameraGesture wheel begin/end

## 2. Dirty tracking + debounced autosave

- [x] 2.1 Extend `projectSession`: `dirty`, `savePhase`, edit generation, `ignoreBookStoreDirty`, shared `runSave()`, 1s debounce, library-backed-only dirty, mid-save generation, error no silent-retry; fold `saving` into `savePhase`; verify unit tests listed in design.md Tests

## 3. Save indicator chrome

- [x] 3.1 Show `data-testid="save-indicator"` in EditorShell from snapshot (`Saved` / pending / saving / error); verify e2e clean Saved + pending after edit

## 4. E2E + perf

- [x] 4.1 Add Playwright coverage: clean indicator; edit → idle → Saved → reload without Ctrl/Cmd+S keeps gallery/placements; `assertDocumentFitsViewport` + named scrollports — verify `pnpm test:e2e` for the new cases
- [x] 4.2 Add throttled autosave-during-drag scenario (zero LoAF; save does not complete mid-drag) to CI/`pnpm perf` — verify scenario is registered and fails on LoAF

## 5. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (623 tests)
- [x] pnpm test:e2e (or pnpm verify) — green (`autosave` + autosave-during-drag; full suite 46/47 then flaky filmstrip packing re-run green)
- [x] pnpm stryker:diff — 100% on `editorGesture.ts` (37 killed). Excluded: `projectSession.ts` (FSA orchestration + autosave locked by unit/e2e), `usePasteboardCamera.ts` (thin gesture toggles; cameraGesture asserts flag), `EditorShell.tsx` (thin chrome + indicator; e2e autosave)
- [x] pnpm test:lhci when UI or bundle size is affected — green
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty: Saved indicator with library, create/open visible, no page H/V scroll; happy: import+place+template → Unsaved/Saving → Saved → reload keeps gallery/placement/template; interact: autosave-during-drag never Saving/Saved mid-drag, zero LoAF; layout: `assertDocumentFitsViewport` + pasteboard `assertNamedScrollport`; a11y: polite save-indicator + labeled actions; anti-slop: existing brand chrome unchanged
- [x] Docs/rules sync: `stryker.mutate.md` / `stryker.config.json` excludes; no AGENTS.md map change; roadmap tick at archive
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (existing FSA write path; no new picker)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 4d2ea1da)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 0fd116e2 pass after tasks evidence; prior delta 939c07b0)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 4aa81ebe — no medium+ findings; existing FSA write path only)

## Workflow follow-up

- Archive the change after implementation review + Manual check pass; sync delta specs; tick roadmap item.
- Commit, push, open PR, wait for CI green.

## Manual test scenarios

1. Open `/?testLibrary=1` — Save enabled; save-indicator shows Saved; no page H/V scroll (pasteboard is vertical scrollport).
2. New book → import one photo → place on a frame → switch template to 2-up — indicator shows Unsaved then Saving… then Saved without Ctrl/Cmd+S; status "Book saved".
3. Reload — Book restored; filmstrip still has the photo; placed frame image visible; 2-up still selected; indicator Saved; no hitch during idle autosave wait.
4. Playwright `e2e/drag-place` autosave-during-drag — continuous drag >1s with dirty book; indicator never Saving…/Saved mid-drag; LoAF gate green; Saved after drag ends.

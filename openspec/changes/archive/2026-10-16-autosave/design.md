# Design

## Context

See proposal.md. Manual save already lives in `projectSession.saveBookNow` (hash await + `scheduler.postTask` background). No dirty tracking or save indicator yet. Gestures today: gallery/frame drag sessions in `galleryDrop` / pasteboard drop; camera zoom via `usePasteboardCamera` (`dataset.gesture === 'zoom'`).

## Goals / Non-Goals

**Goals:** Mark library-backed books dirty on user document edits; debounced autosave when idle and not gesturing; chrome save indicator; e2e reload-without-manual-save; perf gate for continuous drag while debounce would fire.

**Non-Goals:** New storage adapters; permission/lock UX; adopt via autosave; new scrollports.

## Decisions

1. **Dirty + savePhase on project session** — Extend `ProjectSessionSnapshot` with `dirty: boolean` and `savePhase: 'idle' | 'pending' | 'saving' | 'error'`. Chrome maps `!dirty && savePhase==='idle'` → label **Saved**; `pending` / `saving` / `error` map 1:1 (no separate `'saved'` phase). Mark dirty / arm autosave only when `libraryOpen` **and** `bookId !== null` (library-backed). Autosave MUST NOT call adopt. Fold the existing `saving` boolean into `savePhase === 'saving'` as the single in-flight guard for manual + auto via shared `runSave()`. Bump an edit generation when the user dirties; capture it at `runSave` start. On success: clear dirty + `savePhase='idle'` only if the generation is unchanged; if a newer edit arrived mid-save, keep `dirty=true`, set `pending`, and re-arm the full 1 s debounce. On typed save failure: `savePhase='error'`, keep `dirty=true`, leave the in-memory book unchanged; do **not** silent-retry — next user edit or manual Save recovers (edit sets `pending` and arms debounce).

2. **Ignore non-edit store updates** — Subscribe to `bookStore` book-reference changes, but suppress dirty while an internal `ignoreBookStoreDirty` (or equivalent) flag is set around open/create/restore/bind/unbind/`resetBookStore` and any successful save that rewrites the book ref. Only user document mutations set dirty.

3. **Debounce** — Default **1 s** after last dirtying edit (**Assumption:** fixed constant; not user-configurable). On dirty: set `savePhase='pending'`, arm/reset timer. On fire: if `savePhase==='error'`, do not start (wait for next edit or manual Save). If already `saving`, do not start a second save (settle handler above re-arms if still dirty and not error). If gesture active, skip start; on gesture end, re-arm the **full 1 s** debounce only when `savePhase==='pending'` (exclude `'error'`). Cancel timer on reset/unbind.

4. **Gesture seam** — Tiny `src/editor/editorGesture.ts` exporting `setEditorGestureActive` / `isEditorGestureActive` / `installDocumentDragGesture` (document `dragstart`/`dragend`). Camera zoom/pan calls `setEditorGestureActive` on begin/end. Autosave timer in `projectSession` reads `isEditorGestureActive()` only — no DOM / `dataset.gesture` on the timer path.

5. **Indicator** — Thin chrome next to Save (`data-testid="save-indicator"`) reading `dirty` + `savePhase`. Polite text for errors stays on existing editor status. No new scrollport.

6. **Perf scenario** — Attach library, dirty book, start continuous drag spanning > debounce, assert zero LoAF and that save does not complete mid-drag; after drag end, allow save. Register in CI/`pnpm perf` list. Keep existing save-during-drag (explicit Save) green.

## Touch-set

`projectSession.ts` (+tests), `editorGesture.ts` (+ `installDocumentDragGesture`, tests), camera zoom/pan toggles in `usePasteboardCamera.ts`, `EditorShell.tsx` (+ CSS), `e2e/autosave.spec.ts`, autosave-during-drag in `e2e/drag-place.spec.ts`. Prefer not editing `src/project` contracts.

## Composition

`projectSession` owns dirty/debounce/savePhase and calls into `editorGesture` for the gate. Drop/camera only toggle the gesture flag. Chrome is presentational. Core/storage unchanged.

## Tests

Public APIs: `saveBookNow` / autosave via book edits + fake timers, `setEditorGestureActive`, `getProjectSessionSnapshot` phases.

Reuse: `attachMemoryLibraryForTests`, open-save e2e helpers, `assertDocumentFitsViewport` / `assertNamedScrollport`, existing drag perf harness.

- Unit: dirty only with bookId; no dirty on restore; debounce fires when idle; blocked during gesture then full debounce after end when pending; mid-save edit keeps dirty and re-arms after success; failure keeps dirty + error and does not auto-retry until next edit or manual Save.
- E2E: clean indicator Saved; edit → pending/saving → Saved → reload without Ctrl+S keeps edits; viewport containment.
- Perf: autosave-during-drag zero LoAF.
- `ui-review` before push.

## Security

No new FSA picker. Autosave writes only through the already-open `LibraryStorage`. Handles stay out of `book.json`.

## Risks / Trade-offs

- [Debounce during long import] → Book mutations mark dirty; save still awaits pending hashes — may stay `pending`/`saving` longer; acceptable.
- [Gesture flag missed] → False-positive block delays save (safe); false-negative mid-drag save fails the new LoAF gate.
- [Main-thread serialize] → Same as open-save: background schedule first; worker only if gate fails.

## Migration Plan

Additive. Rollback = revert PR.

## Decisions

1. A failing first-batch hook must not abort the batch loop. Today `persistBoundPhotoFolder` throws inside `onFirstBatchYielded`. The loop then exits after batch 1 and drops `importRunning`, so relink auto-detect flags the remaining placeholders and progress sticks.
2. `persistBoundPhotoFolder` returns `Promise<boolean>` (remembered) and never throws. It always applies the in-memory binding, so the session keeps working. `bindPhotoFolder` (persist path, tests only) ignores the boolean and is left unchanged.
3. `importScannedEntriesInBatches` holds a hook error, imports every batch, clears progress, then rethrows.
4. `importPickedFolder` persists once: the `finally` call is skipped when the hook already ran. On `false` it sets the status `Photos added; the folder will need to be added again after reload`. Its `catch` always clears `importRunning` and progress, not only on replace.
5. Security: the handle is persisted only through `rememberSourceRootHandle` / `setBookPhotoRoot`. A failure only lowers durability; no new handle, blob or permission exposure.

## Touch-set & Test Plan

- Files: `src/editor/photoRootSession.ts`, `src/editor/useChromeImport.tsx`, `e2e/import-relink-stall.spec.ts`, spec deltas (editor-shell, filmstrip).
- Test mocks returning `void` for `persistBoundPhotoFolder` (mock return type): `src/App.test.tsx`, `src/editor/EditorTopBar.test.tsx`, `src/editor/useChromeImport.drop.test.tsx`.
- Reuse: `setEditorStatus`, `setImportRunning`, picker double, `createBookViaLibrary`.
- Tests: `photoRootSession.test.ts`, `folderImportBatches.test.ts`, `useChromeImport.persist.test.tsx`. E2e: the root-store IDB `put` throws → 21/21 thumbs, progress hidden, relink dialog never mounted, no page errors.

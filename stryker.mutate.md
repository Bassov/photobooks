# Mutation excludes

Each `!` pattern in `stryker.config.json` `mutate` has one reason here. JSON cannot hold comments.

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/core/index.ts` — re-exports only
- `!src/project/index.ts` — re-exports only
- `!src/assets/index.ts` — re-exports only
- `!src/main.tsx` — Vite entry
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
- `!src/assets/hash.worker.ts` — onmessage wrapper; logic lives in hashDigest.ts
- `!src/project/fsa/bookLoad.worker.ts` — onmessage wrapper; logic lives in bookLoad.ts
- `!src/project/session/idb.ts` — IndexedDB open/get/set/del shell; SessionIdb port covered via injected fakes in browserSessionState tests
- `!src/project/session/locks.ts` — navigator.locks thin adapter; lock name + ifAvailable covered via injected SessionLocks in browserSessionState tests
- `!src/editor/EditorShell.tsx` — thin React chrome wiring for library open/save and save indicator; behavior locked by `projectSession` unit tests and e2e `open-save` / `autosave` / save-during-drag scenarios
- `!src/editor/previewAspect.ts` — JPEG SOF aspect restore covered by unit tests; non-JPEG path only delegates to `processAsset` (mutated via `assetPool`)
- `!src/editor/upgradeSessionAssets.ts` — identity upgrade on adopt locked by `upgradeSessionAssets.test.ts` via `attachMemoryLibraryForTests` / public adopt path; hashing delegates to `hashContent`
- `!src/editor/usePasteboardCamera.ts` — thin `setEditorGestureActive` toggles on existing zoom/pan lifecycle; autosave gate locked by `editorGesture` + `projectSession` unit tests and autosave-during-drag e2e
- `!src/editor/projectSession.ts` — library orchestration + FSA picker/restore (e2e open-save / OPFS); autosave dirty/debounce/phase locked by `projectSession` autosave unit suite + e2e `autosave` / autosave-during-drag; gesture seam mutated via `editorGesture.ts`

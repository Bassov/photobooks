# Mutation excludes

Each `!` pattern in `stryker.config.mjs` `mutate` has one reason here (kept in this file so excludes stay reviewable in one place).

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/main.tsx` — Vite entry
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
- `!src/assets/hash.worker.ts` — onmessage wrapper; logic lives in hashDigest.ts
- `!src/project/fsa/bookLoad.worker.ts` — onmessage wrapper; logic lives in bookLoad.ts
- `!src/project/session/idb.ts` — IndexedDB open/get/set/del shell; SessionIdb port covered via injected fakes in browserSessionState tests
- `!src/project/session/locks.ts` — navigator.locks thin adapter; lock name + ifAvailable covered via injected SessionLocks in browserSessionState tests
- `!src/editor/EditorShell.tsx` — thin React chrome wiring for library open/save, save indicator, re-grant and lock banner; behavior locked by `projectSession` unit tests, `EditorShell` RTL, and e2e `open-save` / `autosave` / `permissions-locks`
- `!src/editor/HomeScreen.tsx` — thin home UI for recents/books; behavior locked by `projectSession` unit tests and e2e `recents-home`
- `!src/App.tsx` — surface switch + bootstrap wiring; locked by App RTL and e2e home/editor entry
- `!src/editor/previewAspect.ts` — JPEG SOF aspect restore covered by unit tests; non-JPEG path only delegates to `processAsset` (mutated via `assetPool`)
- `!src/editor/upgradeSessionAssets.ts` — identity upgrade on adopt locked by `upgradeSessionAssets.test.ts` via `attachMemoryLibraryForTests` / public adopt path; hashing delegates to `hashContent`
- `!src/editor/usePasteboardCamera.ts` — React gesture/lifecycle wiring; fit inset + hold-scroll + delayed zoom-out schedule/apply/cancel mutated via `pasteboardCameraFit.ts`; autosave gate locked by `editorGesture` + `projectSession` unit tests and autosave-during-drag e2e
- `!src/editor/projectSession.ts` — library orchestration + FSA picker/restore, open-vs-adopt, book lock acquire/release, re-grant, home/recents; autosave + permissions/locks + recents-home locked by unit suite + e2e; gesture seam mutated via `editorGesture.ts`; default FSA branches no-cov in unit env

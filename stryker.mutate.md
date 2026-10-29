# Mutation excludes

Each `!` pattern in `stryker.config.mjs` `mutate` has one reason here (kept in this file so excludes stay reviewable in one place).

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
- `!src/project/fsa/bookLoad.worker.ts` — onmessage wrapper; logic lives in bookLoad.ts
- `!src/App.tsx` — surface switch + bootstrap wiring; locked by App RTL and e2e welcome/library/editor entry
- `!src/editor/previewAspect.ts` — JPEG SOF aspect restore covered by unit tests; non-JPEG path only delegates to `processAsset` (mutated via `assetPool`)
- `!src/editor/upgradeSessionAssets.ts` — identity upgrade on adopt locked by `upgradeSessionAssets.test.ts` via `attachMemoryLibraryForTests` / public adopt path
- `!src/editor/usePasteboardCamera.ts` — React gesture/lifecycle wiring; fit inset + hold-scroll + delayed zoom-out schedule/apply/cancel mutated via `pasteboardCameraFit.ts`; autosave gate locked by `editorGesture` + `projectSession` unit tests and autosave-during-drag e2e
- `!src/editor/projectSession.ts` — library orchestration + FSA picker/restore, open-vs-adopt, book lock acquire/release, re-grant, library surface; autosave + permissions/locks + library-screens locked by unit suite + e2e; gesture seam mutated via `editorGesture.ts`; default FSA branches no-cov in unit env
- `!src/editor/photoRootSession.ts` — photo-folder bind/restore/re-grant orchestration; locked by `photoRootSession.test.ts` + directory-picker e2e; mirrors `projectSession` exclude
- `!src/editor/useChromeImport.tsx` — React chrome import wiring; pick/bind/import mutated via `pickPhotos` / `photoRootSession` / `runChromeImport`
- `!src/editor/EditorTopBar.tsx` — chrome button wiring; choose-folder + re-grant locked by EditorTopBar unit + e2e
- `!src/editor/PasteboardEmptyGuidance.tsx` — empty-state CTA wiring; copy/actions locked by PasteboardEmptyGuidance unit + empty-hints e2e
- `!src/assets/fsa/handles.ts` — browser `FileSystemDirectoryHandle` adapter (`entries`/`values` dual-path); high unit NoCoverage; locked by `fsaAssetSource` + scan worker tests
- `!src/assets/scanWalk.ts` — worker-safe directory walk dual-path; high unit NoCoverage on handle.kind branches; locked by `scanWalk` / `scanRoot.worker` tests
- `!src/photo/directoryHandleFromFiles.ts` — VITE_TEST_FIXTURES setInputFiles folder-handle double only (not product UI); locked by `directoryHandleFromFiles.test.ts` + bulk filmstrip e2e
- `!src/project/session/browserSourceRootHandles.ts` — photo-root IDB + VITE_TEST_FIXTURES memory handle store dual-path; locked by `browserSourceRootHandles.test.ts` + folder import/re-grant e2e

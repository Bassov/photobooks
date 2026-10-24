# Mutation excludes

Each `!` pattern in `stryker.config.mjs` `mutate` has one reason here (kept in this file so excludes stay reviewable in one place).

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
- `!src/assets/hash.worker.ts` — onmessage wrapper; logic lives in hashDigest.ts
- `!src/project/fsa/bookLoad.worker.ts` — onmessage wrapper; logic lives in bookLoad.ts
- `!src/App.tsx` — surface switch + bootstrap wiring; locked by App RTL and e2e library-screens / welcome / unsupported entry
- `!src/editor/LibraryScreen.tsx` — placeholder library UI; locked by LibraryScreen unit + e2e library-screens (create/open/change/settings/scrollport)
- `!src/editor/WelcomeScreen.tsx` — placeholder welcome / re-grant UI; locked by WelcomeScreen unit + e2e library-screens / permissions
- `!src/editor/UnsupportedBrowserScreen.tsx` — blocking unsupported copy; locked by browserSupport unit + e2e unsupported gate
- `!src/project/session/browserSessionState.ts` — IndexedDB session adapter + legacy recents migrate; locked by browserSessionState + contract suite + idb tests / permissions e2e
- `!src/project/session/idb.ts` — IndexedDB open/migrate helpers; locked by idb unit + browser adapter contract
- `!src/editor/previewAspect.ts` — JPEG SOF aspect restore covered by unit tests; non-JPEG path only delegates to `processAsset` (mutated via `assetPool`)
- `!src/editor/upgradeSessionAssets.ts` — identity upgrade on adopt locked by `upgradeSessionAssets.test.ts` via `attachMemoryLibraryForTests` / public adopt path; hashing delegates to `hashContent`
- `!src/editor/usePasteboardCamera.ts` — React gesture/lifecycle wiring; fit inset + hold-scroll + delayed zoom-out schedule/apply/cancel mutated via `pasteboardCameraFit.ts`; autosave gate locked by `editorGesture` + `projectSession` unit tests and autosave-during-drag e2e
- `!src/editor/projectSession.ts` — library orchestration + FSA picker/restore, open-vs-adopt, book lock acquire/release, re-grant, library surface; autosave + permissions/locks + library-screens locked by unit suite + e2e; gesture seam mutated via `editorGesture.ts`; default FSA branches no-cov in unit env

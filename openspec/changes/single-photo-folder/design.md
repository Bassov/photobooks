## Decisions

1. **One root per book:** Choose folder mints `sourceRootId`, stores `FileSystemDirectoryHandle` in IDB `source-root-handles` (DB `photobooks-session`, version bump; separate from `library-handles`), registers `createFsaAssetSource`, scans, imports with that id on assets. Change folder (confirm) replaces: clear prior book photo-root + gallery assets from the old root, then bind the new folder.
2. **Picker:** `showDirectoryPicker({ id: 'photobooks-photos', mode: 'read', startIn: 'pictures' })`. No product `showOpenFilePicker` / hidden file inputs. E2e stubs `showDirectoryPicker` for happy-path / abort / re-grant; a VITE_E2E-only multi-file input seam (`e2e-photo-folder-input`) exists solely so bulk LoAF imports can `setInputFiles` without base64 stub walks — not a product fallback.
3. **Reload:** Recall handle → `queryPermission({ mode: 'read' })`. Granted → resolve via handle+path. Prompt → one “Allow access to \<folder\>” → `requestPermission`; denied/missing → missing-assets/relink.
4. **UI primitives** (`docs/design.md`): reuse existing EmptyState / primary Button / quiet Status + Grant tokens (Permission / lock + editor-chrome-states); no new tokens or primitives. Skill `ui-review` before push/archive.
5. **Delete** product file-picker APIs and `source: 'files'` paths; keep folder `partitionImportFiles` semantics.

## Touch-set & Test Plan

- Files: `src/photo/pickPhotos.ts`, `src/editor/useChromeImport.tsx`, `EditorTopBar.tsx`, `PasteboardEmptyGuidance.tsx`, `chromeImportHint.ts`, `Filmstrip.tsx`, `src/project/session/idb.ts` + source-root helpers, import/`projectSession` photo re-grant, `src/assets/fsa/*`, openspec specs above, uikit `m0m1`/`m25`, e2e empty/filmstrip/import helpers.
- Reuse: library IDB + `regrantLibrary`; `createFsaAssetSource` + scan worker; RelinkHost.
- Tests: unit source-root remember/recall/`read`; import registers FSA root; folder-only chrome. E2e: empty Choose folder, happy import, re-grant via directory-picker stubs. PBT N/A. `ui-review` before push.

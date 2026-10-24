## Decisions

1. **First import:** Picker returns the directory handle only (no main-thread full-tree `File[]`). Register FSA `AssetSource` → worker `scanRoot` → capped batches (`yieldForPaint` / `IMPORT_BODY_READ_CAP`); resolve `File` per entry as needed.
2. **Reload re-scan:** Priority queue: visible-spread placed → other open-book assets for that root → other books’ refs by `sourceRootId`+`relativePath`; then cancellable idle remainder (not directory order). Replace blocking `rehydrateSessionFilesFromRoot`. Size/mtime fast path unchanged.
3. **Lazy vs Save:** Prioritized hashes that feed encode-after-hash stay on `trackHashJob` / `awaitPendingHashes`. Idle unused-file hashes MUST NOT block Save.
4. **Security:** Photo roots remain IDB + `mode: 'read'`; domain API handle-free; cancel drops idle work without elevating access.
5. **UI:** `docs/design.md` Status + ProgressBar (Theme B filmstrip chrome); placeholder copy; stable `import-progress` / re-scan testids. Skill `ui-review` before push.
6. **Perf:** Vitest + memory/FSA doubles (~3k–4k tiny images): no scan long task ≳100 ms; used-in-book before lazy. Do not lower `PERF_BUDGETS`.

## Touch-set & Test Plan

- Files: `openspec/changes/folder-import-perf/**`; `src/photo/pickPhotos.ts`; `src/editor/{useChromeImport,importPhotos*,photoRootSession,FilmstripStatus}` (+ pure priority/idle helpers); `src/perf/budgets.ts` if shared ceiling; specs `asset-source`, `frame-budget`, `editor-shell`, `derived-cache`.
- Reuse: worker scan/hash, `runImportBatch`, memory FSA doubles, Status/ProgressBar.
- Tests: unit priority + cancel + large-folder responsiveness; e2e happy import progress; empty folder; `ui-review`.

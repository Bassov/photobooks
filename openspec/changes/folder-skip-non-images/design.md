## Decisions

1. Export `isImageLikeFile` in `pickPhotos.ts`: `image/*` MIME or extensions `.jpg/.jpeg/.png/.webp/.heic/.heif/.tif/.tiff`.
2. `partitionImportFiles(files, { source })`: when `source==='folder'`, non-image-like → `skipped[]`; image-like unsupported → `rejected`. Default `source==='files'` keeps today’s reject-all-non-accepted.
3. `ImportPhotoOptions.source: 'files'|'folder'` (default `'files'`); wire `'folder'` through existing `runChromeImport` / `useChromeImport` folder paths.
4. Return `skipped: number`; progress `total` = accepted+rejected only. One polite `editor-status` line when `skipped>0` and no import errors; never list skips in `import-errors`.
5. Empty-folder hint still uses raw picker `files.length` so README-only folders keep “No photos found”.
6. Security: classify only already-picked Files; no change to directory/file picker prompts, permission UX, workers, blob URLs, or CSP.

## Touch-set & Test Plan

- Files: `src/photo/pickPhotos.ts`, `src/editor/importPhotos.ts`, `src/editor/runChromeImport.ts`, `src/editor/useChromeImport.tsx`; specs `photo-card`, `filmstrip`, `editor-shell` (import-errors); roadmap ticks.
- Reuse: `isAcceptedPhotoMime` / `isHeicLikeFile`; existing Theme B `Status` (`politeness="polite"`, `data-testid="editor-status"`) from design.md Feedback+overlays / filmstrip row.
- Tests: unit pickPhotos / importPhotos / chrome status; e2e empty (README-only, no tiles) + happy (JPEGs+README, skip status, no import-errors) via `folder-file-input`. Skill `ui-review` before push.

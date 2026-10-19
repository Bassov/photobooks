# folder-skip-non-images

Tag: feature
Milestone: M2.2
Title: folder import skips non-image files with one summary line instead of errors

## Scope

- [ ] Root cause, verified on main: `collectImageFilesFromDirectory` returns every file (`src/photo/pickPhotos.ts:47-50` doc, `:68-86`), the `webkitdirectory` fallback does the same (`src/editor/EditorShell.tsx:355-374`), and `partitionImportFiles` (`pickPhotos.ts:92-110`) turns each into `Unsupported image format: <mime>`, which `importPhotos.ts:59-63` reports as errors. `importPhotoFiles` does not know the files came from a folder
- [ ] `ImportPhotoOptions` (`src/editor/importPhotos.ts:29-34`) gets `source: 'files' | 'folder'` (default `'files'`). Both folder paths in `EditorShell.tsx` pass `'folder'` (directory picker `:137-146`, folder input onChange `:366-373`) through `runImport` (`:103`)
- [ ] For `'folder'`, `partitionImportFiles` splits a third bucket, `skipped`: files that are not image-like (MIME not `image/*` and no image extension). Image-like but unsupported files (`image/tiff`, `.heic`/`.heif` with empty or octet-stream MIME) keep their per-file error. Explicitly picked files keep today's behavior. The result returns `skipped: number`, and the editor shows one non-error line ("N non-image files skipped") in the existing polite status (`EditorShell.tsx` `editor-status`), not in `import-errors`. Skipped files count toward neither `total` nor the photo count
- [ ] Put the image-like test in one exported helper in `src/photo/pickPhotos.ts` (e.g. `isImageLikeFile(file)`: `image/*` MIME or an image extension incl. `.heic`/`.heif`/`.tif`/`.tiff`). `heic-unsupported-message` (next M2.2 item) reuses it to replace the generic message for HEIC; this item must not add HEIC-specific copy
- [ ] Spec delta `editor-shell` "Import folder or files into gallery" (`openspec/specs/editor-shell/spec.md:23-40`, scenario "Reject unsupported type in a batch" stays for picked files) + `photo-card` "Accepted and rejected image types" (`openspec/specs/photo-card/spec.md:23-25`): a folder import skips non-image files without an error and shows a summary
- [ ] Tests: unit `pickPhotos.test.ts` (README.md / .txt / .DS_Store skipped; .tiff / extension-only .heic still rejected), `importPhotos` (skipped count, no errors, total excludes skipped), `EditorShell` (status text). e2e via `folder-file-input` with JPEGs + `README.md`: no `import-errors`, the status shows "1 non-image file skipped", the count equals the JPEG count
- **Done when:** (1) the e2e regression test above fails on main (`README.md: Unsupported image format: text/markdown`) and passes on the branch; (2) a picked (non-folder) `README.md` still shows the per-file error (existing `e2e/filmstrip.spec.ts:256-263` stays green); (3) the spec deltas are archived; (4) patch coverage ≥ 85%, Stryker diff ≥ 85 with zero NoCoverage, and no gate weakened or newly excluded
- **Perf:** filtering is a sync pass over names/MIME before enqueue, inside the measured kickoff budget (`import-photos` handler label `importPhotos.ts:25`); the bulk-import frame-budget scenario stays green.
- **Browser check:** on the preview URL, Add folder on a directory with photos plus a `README.md` and a `.txt`. No error list appears, a status line says "2 non-image files skipped", and the photo count matches the images. Add photos with a `README.md` picked directly still shows an error for it.
- **UI kit:** `uikit/src/features/m0m1.tsx:248-256` (`editor-shell-filmstrip`, `UI ref: uikit#/feature/editor-shell-filmstrip` — “folder without images” empty hint; toast for skipped unreadable files). partial: polite non-error status “N non-image files skipped” (kit only toasts failures / empty-folder hint)
- **Size:** ~150–250 changed lines (partition + option plumbing + status line + spec deltas + tests)
- **Source:** #39

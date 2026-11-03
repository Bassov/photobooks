## Decisions

1. Root cause (red e2e on `main`): `isAcceptedPhotoPath` accepts `._*` by extension; a failed decode is dropped for the live session only, so on reload the manifest / walk re-mints it as a silent gray tile.
2. One rule `isHiddenPhotoPath(path)` in `src/photo/pickPhotos.ts`: any `/` segment starting with `.`. `isAcceptedPhotoPath` / `isImageLikePath` reject it, `isClearFolderSkipPath` skips it silently, `partitionImportFiles` puts it in `skipped`. Pure string logic, no new FS access.
3. Failure memory = folder manifest flag `decodeFailed: true`, written by `discardFailedImport` via the existing patch queue; kept by the walk merge only while size + mtime match. IDB metadata only. Chosen over an error tile: no new UI.
4. `startFolderRescan` (reload): `decodeFailed` entries are filtered out before the manifest / walk enqueue; unplaced gallery ids with hidden or failed paths are dropped; failed paths stay out of the lazy import and get one `decode-failed` Import error each. A fresh pick / re-add retries.

## Touch-set & Test Plan

| File                                          | Change                                                          |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/photo/pickPhotos.ts`                     | hidden-path rule; `isImageLikeFile` (picker / drop) inherits it |
| `src/project/session/sourceRootEntryIndex.ts` | `decodeFailed` parse / merge / patch                            |
| `src/editor/importPhotos.ts`                  | record the failure on discard                                   |
| `src/editor/folderManifestWrite.ts`           | `tryMarkManifestDecodeFailed` beside the dims write             |
| `src/editor/photoRootSession.ts`              | filter failed entries before enqueue, rescan drop + re-report   |
| `src/editor/useChromeImport.tsx`              | no edit: covered via `isClearFolderSkipPath`                    |
| `src/editor/enqueueScannedGalleryList.ts`     | no edit: covered via `isAcceptedPhotoPath`                      |

- Tests: unit path table + partition; manifest flag; mark-on-discard; rescan filter; e2e `e2e/filmstrip-appledouble-skip.spec.ts`.

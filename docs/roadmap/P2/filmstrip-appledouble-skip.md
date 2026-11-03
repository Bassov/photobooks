# filmstrip-appledouble-skip

Tag: feature
Milestone: P2
Title: Bug: filmstrip gray tiles from `._*` AppleDouble files; decode-failed photos return as blank tiles after reload
Status: done

## Scope

- [x] One hidden-path rule in `src/photo/pickPhotos.ts`: `._*`, `.DS_Store` and any path segment starting with `.` (`.Trashes/`, `.Spotlight-V100/`) never become photos or import errors; every scan / manifest hydrate / file-picker / drag-drop filter uses it
- [x] On folder rescan (reload), gallery ids already persisted with hidden paths are dropped (filter only, no migration shim)
- [x] A real decode failure is remembered in the folder manifest (identity-keyed: size + mtime); after reload the path stays out of the strip and is re-reported in Import errors — never a silent gray tile
- **Bug rule:** every caller of `isAcceptedPhotoPath`, `isImageLikePath`, `isClearFolderSkipPath`, `partitionImportFiles` and the manifest hydrate is fixed or listed in the PR body with a reason
- **Done when:** e2e folder with `._X.JPG` + `.DS_Store` + `.Trashes/x.jpg` + real JPGs → only the real tiles, no import error; reload ×2 → 0 tiles without a decoded image; re-add the same folder → no errors. e2e corrupt JPG stays in Import errors after reload ×2 and never shows as a tile. Unit tests for the path rule (`._a.jpg`, `dir/._a.JPG`, `.hidden/a.jpg`, `.DS_Store` rejected; `a.jpg`, `dir.v2/a.jpg` accepted). Repo checks green; PR body: root cause, caller list, before/after e2e numbers
- **Perf:** N/A — one string check per scanned path; the decode-failed flag rides the existing coalesced manifest patch queue
- **Browser check:** pick a folder copied from a macOS volume (with `._*` and `.DS_Store`) → only real photos in the strip, no Import errors; reload twice → no gray tiles; add a truncated JPG → it is listed under Couldn't decode after reload and has no tile
- **Hard nos:** no edits in `uikit/`, `src/editor/frameGesture*`, `frameHandleGesture*`, `bookHistory*`, `src/core/ops/*`, `src/core/grid/*` (other lanes)
- **Source:** owner report 2026-11-03 (gray tiles `asset-1._DSCF8655.JPG`; Import errors "Couldn't decode (2): .\_DSCF8661.JPG, .\_DSCF8732.JPG")

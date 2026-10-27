## Decisions

1. View state (`sort`, `unplacedOnly`) is React state in `FilmstripDock`, set inside `startTransition`; `Filmstrip` derives view ids/aspects/names with `useMemo` via a pure `galleryView.ts`. Book gallery order stays "added".
2. Capture time: reuse `extractAssetMetadata` (already maps `DateTimeOriginal`→`capturedAt`) on the 64 KB head `runJpegHeadPass` reads; no new parser. The pass's early return also reads the head when `capturedAt` is missing (covers pre-existing/reopened assets), then `patchAssetRecord`. Sort key = `capturedAt` → `mtimeMs` → added order (stable, undated last).
3. "Unplaced" uses a cached placed-id set in `bookStore` (recomputed per book identity, reference-stable when unchanged).
4. Removal reuses `removeFailedImportAssets` (cascades `removeManyFromGallery`, clears frames) via new `removeAssetFromGallery`. Placed → AlertDialog (destructive); unplaced → immediate, status line message (not toast, per spec). Requests go through a tiny `galleryRemoveRequest` store rendered as one dialog in the Dock; × on thumb and a filmstrip branch in `installEditorKeys` (`galleryDrop.ts`) both call it. Selection cleared. Risk: a removed photo may reappear on an explicit folder re-import (file stays on disk).
5. Spacer width uses view length while filtering; empty-filter shows "All photos are placed."

## Touch-set & Test Plan

- Files: `src/editor/{galleryView.ts,FilmstripDock.tsx,Filmstrip.tsx,FilmstripItem.tsx,bookStore.ts,galleryRemoveRequest.ts,galleryDrop.ts,jpegHeadPass.ts,Filmstrip.css}`, `openspec/specs/filmstrip/spec.md`. No gate-config edits.
- Reuse: `ui/Menu` (same pattern as `LibSort`; kit `select` is visual only), `ui/ToggleButton`, `ui/AlertDialog` (destructive tone → existing destructive token), `ui/EmptyState`, `setEditorStatus`, `extractAssetMetadata`.
- Tests: unit `galleryView` (+PBT: sort is a stable permutation, filter ⊆ ids); Dock/Filmstrip RTL (sort order, filter shrink, empty, dialog on placed, immediate on unplaced); head-pass capturedAt; e2e: 1000-photo scroll + filter toggle zero LoAF, filter shrinks after placing, empty-filter copy, placed-removal dialog empties frame. Skill `ui-review` before push.

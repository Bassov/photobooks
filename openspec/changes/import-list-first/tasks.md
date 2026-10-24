## Implementation

- [x] 1. Spec deltas: asset-source / filmstrip / image-tiers (+ photo-card / editor-shell) under `openspec/changes/import-list-first/specs/`
- [x] 2. Entry index: persist path→size/mtime after cheap walk; always call `scanRoot` on visit; detect new/changed vs index (no count/max-mtime skip)
- [x] 3. Identity/match: `matchAssets` + import reuse use path+size+mtime only; remove content-hash prefer/fallback from hot path
- [x] 4. List-first import/rescan: enqueue gallery from `ScannedEntry[]` before body/`getFile`; then priority resolve+thumb320 for visible ∪ book-used; idle remainder placeholders
- [x] 5. Unit: match metadata-only; always-walk; list before body; decode priority; entry-index new/changed
- [x] 6. e2e: `list-first folder pick shows gallery placeholders before all thumbs` (+ existing reload/scroll coverage)

## Manual test scenarios

1. Pick large folder: filmstrip shows name/size placeholders for the full list before thumbs finish; visible tiles get 320 first.
2. Reload / reopen granted root: cheap full walk runs; unchanged metadata reuses assets/previews; new/changed paths update; no body reads during the walk.
3. Scroll filmstrip while many placeholders remain: newly visible tiles decode before off-window idle remainder.
4. N/A unsupported-browser / multi-folder / individual-file import.

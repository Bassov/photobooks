# editor-shell-filmstrip

Tag: feature
Milestone: M1
Title: editor layout and gallery

## Scope

- [x] Editor layout: workspace above, filmstrip below (replaces the single photo-card screen; update `photo-card` spec)
- [x] Add a folder (directory picker, `webkitdirectory` fallback) or individual files; append to the gallery
- [x] Asset worker pool: sized from `hardwareConcurrency`, priority queue (visible first), transferables; per-file errors do not abort the batch; progress. **Shipped note:** folder scan still runs on the main thread; off-screen import jobs are not aborted (see `docs/lessons.md`) — visibility may boost priority only.
- [x] Horizontal virtualized filmstrip (React Aria GridList + Virtualizer); placeholders with aspect ratio first, thumbnails stream in
- [x] Bounded object-URL LRU with revoke on eviction
- **Perf:** pre-sized thumbnails only, `decoding="async"`, gallery updates batched per frame; scenario: import 200 photos while scrolling the filmstrip — zero LoAF.
- **Browser check:** add a folder of 100+ photos, scroll the filmstrip during import without stutter; document does not grow H/V scrollbars; filmstrip is the horizontal scrollport; add more files later.
- **UI ref:** `uikit#/feature/editor-shell-filmstrip`

# Proposal

## Problem

The app is still a single photo-card screen. Gallery ops and layout math exist in `src/core`, but there is no editor shell, no way to import a folder into the book gallery, and no virtualized filmstrip — so the M1 editing loop cannot start.

## Why now

Next M1 item in `docs/roadmap.md` after `layout-geometry`. Pasteboard, camera, and drag semantics all need a gallery filmstrip fed by a non-blocking asset worker pool.

## Scope in

- Editor layout: workspace above (placeholder), filmstrip below; replaces the photo-card-only screen
- Add a folder (directory picker / `webkitdirectory` fallback) or individual files; append to the in-memory book gallery
- Asset worker pool with visible-first priority, cancellation when a thumbnail scrolls away, folder scan and file reads off the main thread; per-file errors do not abort the batch; progress
- Horizontal virtualized filmstrip; aspect-ratio placeholders first, thumbnails stream in
- Bounded object-URL cache with revoke on eviction
- Perf scenario: import ~200 photos while scrolling the filmstrip — zero LoAF

## Scope out

- Real pasteboard / `SpreadView`, templates on canvas (`pasteboard-workspace`)
- Camera zoom/pan, drag-and-drop place/replace (`camera-zoom-pan`, `drag-gallery-canvas`)
- Persistence, hashing, OPFS (`library-storage`, `asset-identity`)
- Filmstrip sort/filter/height (`filmstrip-management`)

## Capabilities

### New Capabilities

- `editor-shell`: editor chrome with workspace placeholder and gallery filmstrip; folder/file import into the book gallery; import progress

### Modified Capabilities

- `photo-card`: single-card open flow is replaced by gallery import into the editor shell; worker-based decode/EXIF remain, retargeted to the filmstrip path
- `frame-budget`: replace the photo-card single-file LoAF import scenario with bulk filmstrip import while scrolling

## Success criteria

- User sees workspace above and a horizontal filmstrip below (not the old single photo-card screen)
- Adding a folder or files appends assets to the gallery; placeholders appear with aspect ratio; thumbnails stream in without freezing scroll
- A later folder or file import appends without clearing prior gallery assets
- Per-file failures show without aborting the rest of the batch; import progress is visible
- Playwright scenario importing ~200 photos while scrolling the filmstrip records zero LoAF
- Object URLs stay bounded (revoke on eviction)

## Risks

- Security: File System Access, workers/`postMessage`, blob object URLs, and new UI dependency surface — needs Security Review before archive
- Bulk gallery React updates or URL leaks under virtualization could break the LoAF / memory budgets
- Virtualizer fit for a dense horizontal gallery may need careful composition

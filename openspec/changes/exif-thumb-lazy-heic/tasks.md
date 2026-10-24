## Implementation

- [x] 1. Spec deltas: asset-source (JPEG head pass → dims/manifest), filmstrip (EXIF thumb placeholder), image-tiers (lazy HEIC decode gate), photo-card (HEIC gallery placeholders + lazy decode); trim obsolete reject-only HEIC wording that conflicts
- [x] 2. Pure helpers: extract EXIF JPEG thumbnail + header dims/orientation from a head buffer (present / absent / corrupt safe)
- [x] 3. Import head pass: bounded parallel 64KiB reads after list-first enqueue; publish temp thumb + sessionMeta; patch manifest dims
- [x] 4. Lazy HEIC: accept into gallery; skip prefetch/background decode; enqueue at `visible` when filmstrip-visible ∪ book-used; HEIC decode failure keeps placeholder
- [x] 5. Unit tests for (2)–(4); keep e2e open-save / filmstrip / frame-budget green

## Manual test scenarios

1. First import of a JPEG folder (no OPFS thumbs): visible tiles show EXIF thumbs or grey quickly; aspects correct from header before thumb320.
2. Folder with off-screen HEIC + visible JPEGs: decode pool has 0 jobs for off-screen HEIC; scrolling HEIC into view queues decode at visible priority.
3. Place a HEIC on a spread (or mark book-used): decode queued; placeholder remains if decode unsupported.
4. N/A multi-folder / unsupported browser.

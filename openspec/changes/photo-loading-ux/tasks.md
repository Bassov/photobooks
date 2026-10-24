## Implementation

- [x] 1. Rewrite `image-tiers` (+ trim `derived-cache` / `filmstrip` / `frame-budget`) for thumb+1280 only; remove obsolete ladder requirements.
- [x] 2. Collapse `IMAGE_TIERS` to `[1280]`; update `selectImageTier`, display/ladder helpers, e2e `tierCovers`.
- [x] 3. Worker decode: `createImageBitmap` resize options when `maxEdge` caps; keep orientation via OffscreenCanvas.
- [x] 4. Visible priority: union filmstrip window + active spread asset ids; cap decode pool ≤4; cancel stays on unsubscribe.
- [x] 5. Confirm progressive thumb→1280 + OPFS hit path; tighten unit coverage for removed tiers.

## Manual test scenarios

1. Empty gallery: placeholders only; choose folder → progressive thumbs; no page-level scroll.
2. Place photos on spread: thumb then working preview; zoom past 1280 stays on 1280 without blank flash.
3. Scroll long filmstrip: visible tiles prioritize; chrome interactive; scroll only inside filmstrip.

## Implementation

- [x] 1. Byte-bounded hot cache in `thumbCache.ts`: one `{ blob, url, byteLength }` entry per asset, URL at byte arrival, O(1) `getThumbUrl`, revoke on eviction / removal / replace / reset, puts read `blob.arrayBuffer()` (`thumbCache.test.ts`).
- [x] 2. Publish: listener-only notifies, scrollport first, ≤ 8 or ≤ 3 ms per frame, drop unmounted, scrollport publishes during scroll quiet (`thumbCache.test.ts`).
- [x] 3. DerivedCache hydrate priority queue (scrollport first, drop unmounted before read) (`thumbCache.test.ts` "DerivedCache hydrate queue").
- [x] 4. Direction-aware window overscan (`filmstripWindowRange`) + scrollport provider in `Filmstrip.tsx` (`thumbSlotSize.test.ts`, `Filmstrip.test.tsx`).
- [x] 5. Spec delta `filmstrip`: byte-bounded URLs; cached thumbs remount without placeholder.
- [x] 6. e2e fling probe (≥ 400 tiles, 0 placeholders per frame) + `frame-budget gates` scenario "fast scroll back over seen tiles" (`e2e/thumb-hot-cache.spec.ts`).

## Manual test scenarios

1. Folder with 1000+ photos: once thumbs have loaded, fling the strip to the end and back: no gray tiles.
   - Harness problem: `pnpm agent manual-qa --change thumb-hot-cache` never reached the editor (`start-session` click intercepted by the welcome `<header>`; same on main). Not a product finding.
   - Evidence instead: `e2e/thumb-hot-cache.spec.ts` (400 tiles, fling end → start → end at 240 px/frame): 0/418 frames with a placeholder in the scrollport (origin/main src: 150/418, max 10); "fast scroll back over seen tiles" 0 LoAF. `bulk filmstrip import while scrolling` and `1000-photo gallery scroll, sort and filter toggle` pass (0 LoAF) on the branch.

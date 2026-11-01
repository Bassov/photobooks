## Decisions

1. One `Map` entry per asset; insertion order is the LRU (set and mount re-insert). The URL is created at byte arrival, so a cached tile remounts with its thumb. Byte budget eviction skips mounted ids. Security: same-origin `blob:` URLs only; revoked on eviction, replace, reset and asset removal (`bookStore.subscribeAssetRemovals`). `ObjectUrlLru` and `lastThumb` go.
2. Notifies only for ids with listeners, per rAF (watchdog kept), scrollport first within a frame budget; unmounted ids drop. During scroll quiet only scrollport ids publish.
3. Scrollport ids come from a provider the filmstrip registers (stride prefix + last scroll offset + width; no layout reads).
4. Mount hydrate queue: 4 parallel DerivedCache reads, scrollport first; a mounted tile's request drops if it unmounts before the read; miss decode runs outside the slot.
5. Window = scrollport + max(width, 2 widest slots) ahead in the scroll direction + 2 slots behind; commit when either edge moves.

## Touch-set & Test Plan

- Files: `src/editor/thumbCache.ts`, `thumbSlotSize.ts`, `filmstripScrollCommit.ts`, `Filmstrip.tsx` (window + provider only), `bookStore.ts` (removal listener), `projectSession.ts` (stats seam), `e2e/thumb-hot-cache.spec.ts`, `e2e/perf/perfFixture.ts` (seam type), `package.json` (`perf` file list).
- Reuse: `filmstripScrollQuiet`, `indexFromScrollOffset`, `__photobooksThumbs`, perf LoAF fixture.
- Tests: unit (cache bound, eviction, publish order/budget, hydrate queue), PBT (window range), Filmstrip component, e2e fling probe + `frame-budget gates` scenario. Empty-strip e2e unchanged; `ui-review` N/A (no visual change).

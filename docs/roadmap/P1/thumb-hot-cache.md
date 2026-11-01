# thumb-hot-cache

Tag: feature
Milestone: P1
Title: Filmstrip: a thumb that loaded once never goes gray again
Status: done

## Scope

- [ ] `src/editor/thumbCache.ts`: replace the 256-entry `ObjectUrlLru` plus the `lastThumb` ArrayBuffer map with one entry per asset `{ blob, url, byteLength }`. Create the object URL when the bytes arrive; revoke it only on eviction, asset removal / identity change, or `resetThumbCache`. Bound the cache by bytes (about 128 MB, LRU past the budget), not by count. DerivedCache puts read `blob.arrayBuffer()` instead of a retained copy. `getThumbUrl` is O(1) (today `ObjectUrlLru.touch` runs `indexOf` + `splice` on every snapshot read).
- [ ] Publish: notify only ids with listeners (mounted tiles), viewport first, with a per-frame budget (≤ 3 ms or ≤ 8 notifies) instead of `FLUSH_PER_FRAME = 1`. Drop pending notifies for unmounted ids (their bytes stay cached). While the 200 ms scroll-quiet window is open, still publish ids inside the scrollport within the budget. Today the pending Map keeps insertion order and keeps unmounted ids, so after a long fast scroll the visible tiles come last, one per frame.
- [ ] DerivedCache hydrate on mount goes through a small priority queue: visible first; drop a request when its tile leaves the window before the read starts.
- [ ] Filmstrip window overscan (`src/editor/Filmstrip.tsx` `windowOverscanPx`, `src/editor/thumbSlotSize.ts` `indexFromScrollOffset`): direction-aware, about one scrollport width ahead in the scroll direction and at least 2 slots behind, so `<img>` decode starts before the tile enters the view.
- [ ] Spec delta `filmstrip` ("Placeholders, thumbnails, and aspect slots", "Progressive reveal and import pacing"): thumb object URLs are bounded by a byte budget; a tile whose thumb bytes are cached in this session renders the thumb on remount, with no placeholder.
- **Done when:** new e2e: folder of ≥ 400 small images; wait until every thumb is published (test seam); scroll fast end → start → end in `scrollLeft` steps; a per-rAF probe counts `[data-testid=filmstrip-placeholder]` elements intersecting the scrollport: 0 in every sampled frame. `thumb-reload-cache-miss` e2e and existing filmstrip e2e green.
- **Browser check:** folder with 1000+ photos: once thumbs have loaded, fling the strip to the end and back: no gray tiles.
- **Perf:** new `frame-budget gates` scenario "fast scroll back over seen tiles" (≥ 400 tiles) at 0 LoAF; `bulk filmstrip import while scrolling` and `1000-photo gallery scroll, sort and filter toggle` stay at 0 LoAF.
- **UI kit:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, FilmstripPart`); no visual change
- **Hard nos:** no new dependency; no change to tile look; no unbounded memory
- **Test:** unit (cache bound, eviction revokes, publish order / budget) + new e2e + perf scenario
- **Depends:** thumb-reload-cache-miss

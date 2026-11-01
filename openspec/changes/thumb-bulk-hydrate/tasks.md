## Implementation

- [x] 1. `hydrateGalleryThumbs` in `thumbCache.ts`: outward-from-window batches of 8, yield between batches (one batch per frame while the strip scrolls), budget stop, cancel on reset/new run, removal drops (`thumbCache.test.ts` › restore bulk hydrate, 11 cases)
- [x] 2. Start it in `startFolderRescan` right after the manifest-first enqueue (`folderRescan.test.ts` › hydrates cached gallery thumbs before scanRoot resolves)
- [x] 3. Test seam `getThumbBulkHydrateStatsForTests` on `window.__photobooksThumbs` (`projectSession.test.ts`)
- [x] 4. `e2e/thumb-bulk-hydrate.spec.ts`: 400 cached thumbs, reload, done seam, fling end and back → 0 placeholders (418 frames, 0 placeholder frames); its `frame-budget gates` describe: reload + immediate scroll → 0 LoAF
- [x] 5. Roadmap gate: measure 1000-thumb hydrate (median of 3; scratch spec deleted); if ≤ 3 s, `pnpm roadmap done thumb-pack-storage` — "Book restored" → 1000 hot thumbs: origin/main 31.5 s (mount-driven, strip stepped one scrollport at a time), this branch 2.44 s with no scroll (pass alone 2.30 s); ≤ 3 s, so `thumb-pack-storage` is closed

## Manual test scenarios

1. Reopen a book with a 1000+ photo folder; right after "Book restored" fling the strip to the end and back: thumbs everywhere.
   - OK (scripted real browser, preview build, OPFS photo folder of 1000 PNGs, cold reload ×3): fling starts at "Book restored"; all 1000 thumbs hot after 3.1 / 3.4 / 3.4 s; placeholders in the scrollport in 31–84 of 1048 frames (3–8 %, max 10), all early in the fling before the pass reaches them. `manual-qa` subagent not used: it cannot build a 1000-photo OPFS folder; the 400-photo case is locked by `e2e/thumb-bulk-hydrate.spec.ts`.

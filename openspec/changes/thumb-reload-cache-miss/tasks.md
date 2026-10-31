## Implementation

- [x] 1. e2e repro `e2e/thumb-reload-cache-miss.spec.ts` (fails on main: 14/14 mounted tail tiles gray after 60 s; passes with the fix).
- [x] 2. `src/editor/thumbMissDecode.ts` + `ensureThumb` cache-miss branch: resolve File (retained or registered `AssetSource`), decode thumb320 through the pool, publish + cache, restore aspect; unit tests for the miss branch (`src/editor/thumbMissDecode.test.ts`, `thumbCache.test.ts`; stryker:diff 100%).

## Manual test scenarios

1. Folder with 200+ JPEGs: look only at the first screen, save, reload, scroll to the end: every tile fills in, none stays gray.: harness problem / `pnpm agent manual-qa` timed out on `start-session` (welcome header intercepts pointer events), no product verdict; covered by `e2e/thumb-reload-cache-miss.spec.ts` "reload: never-shown JPEG tail tiles decode upright thumbs on scroll" (green locally).

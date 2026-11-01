# thumb-bulk-hydrate

Tag: feature
Milestone: P1
Title: On book open, load all cached thumbs before the user scrolls

## Scope

- [x] On restore, right after the manifest-first gallery enqueue, read every gallery asset's identity thumb from DerivedCache into the hot thumb cache (`src/editor/thumbCache.ts`) in the background: concurrency 8, outward from the current filmstrip window, yield between batches, stop at the cache byte budget. Tiles mounted later take the cached URL with no placeholder.
- [x] Measure hydrate time for 1000 cached thumbs on the perf fixture (one OPFS file per thumb today) and write it in the PR body. If it is ≤ 3 s, close `thumb-pack-storage` in this PR: `pnpm roadmap done thumb-pack-storage --note "not needed (gate passed in thumb-bulk-hydrate)"`.
- **Done when:** new e2e: book with ≥ 400 cached thumbs, reload, wait for the hydrate-done seam, scroll fast to the end and back: 0 placeholders in the scrollport (same probe as `thumb-hot-cache`).
- **Browser check:** reopen a book with a 1000+ photo folder; right after "Book restored" fling the strip to the end and back: thumbs everywhere.
- **Perf:** new `frame-budget gates` scenario: reload, then immediate filmstrip scroll while hydrate runs: 0 LoAF.
- **UI kit:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, FilmstripPart`); no visual change
- **Test:** unit (hydrate order, budget stop) + e2e + perf scenario
- **Depends:** thumb-hot-cache

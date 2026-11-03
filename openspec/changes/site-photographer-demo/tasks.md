## Implementation

- [ ] 1. `site-viewer.tsx`: export `Fullscreen`, add `ratio?: number` (default `SW / SH`) to the width.
- [ ] 2. `site-photographer.tsx`: fixture (6 books, spreads, texts) and layout from the root width.
- [ ] 3. Masthead, home (intro, shelf, About, footer) with hover / focus states.
- [ ] 4. Book page (hero text + facts + actions, closed book, `SiteSpread` list, Next book) and Fullscreen at the book ratio.
- [ ] 5. Register the page (`pages.tsx`, `pages.json`) and add the kit qa smoke `site-photographer`.

## Manual test scenarios

1. `#/full/site-photographer` 1440 × 900: home shelf, click Lake trip, scroll the spreads, click spread 3 → Fullscreen
   "Pages 6–7 · 6 / 22", Esc → focus on the spread; Share → link; Next book → Coast.
2. 390 px: one column, masthead 56; `#/feature/site-photographer` (frame 1116): two columns of 494.

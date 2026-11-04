## Implementation

- [x] 1. Entry `#/full/site-demos` + `site-demo-1` registered (`pages.tsx`, `pages.json`).
- [x] 2. Site theme `[data-surface="site"]`, grain, true Lora italic files (`site-demo-1/site.css`, `uikit/src/fonts/lora-*-italic.woff2`).
- [x] 3. `Book3D` (spine, thickness, true sizes, rest / hover / pressed poses), cover face and spread art copies.
- [x] 4. Home: masthead, hero with the pointer-following book, shelves, About, dark footer, reveal on scroll, cursor label.
- [x] 5. `BookReader`: rigid turn 800 ms with shading and cast shadows, cover open / back close 1000 ms, click / keys / drag, corner lift, crossfade jumps, reduced motion.
- [x] 6. Book page: stage, progress, controls, About this book, All spreads, Next book, shelf → book view transition, Fullscreen reader 1248×780.
- [x] 7. Kit qa smoke `site-demo-1`; hue / no-blue scans skip the site theme (book cloth colours are content).
- [x] 8. Demo 2 "Night gallery" (Spec `site-awards-5` Item 1): `site-demo-2/` (site, book page, css), route `#/full/site-demo-2`, entry names; `BookReader` additive `leaf="paper"` (12 strips), `board`, `turnMs` (demo 1 defaults unchanged); kit qa demo-2 check (open → reader, → turns, Esc home, reduced motion ≤ 300 ms, no app greys, no text < 11 px); site-theme scans match `[data-surface^="site"]`.

## Manual test scenarios

1. 1440×900 `#/full/site-demo-1`: shelf books 288×360 / 360×288 / 300×300; open Lake trip → reader 896×560; → opens the cover, → turns; drag from the right edge turns, a short drag springs back; Fullscreen 1248×780, → turns; Esc returns. Reduced motion: → changes the view at once, no leaf. — OK (kit qa + scratch Playwright walk, no console errors). Agent manual-qa cannot drive the kit.
2. 1440×900 `#/full/site-demo-2`: Lake trip 336×420 on the ledge, wheel 700 walks to 02 / 06 and back; open → camera walk → reader 1000×625 at top 168, focus on the reader; → opens the cover, → curls a paper leaf; drag held at 60° / 125° shows the curl, release past 90° turns; Esc → home, focus on Lake trip. Same at 900×700 (reader 660×413) and 390×844 (snap bays, reader 350×219). Reduced motion: → lands in < 150 ms, no leaf. — OK (kit qa + scratch Playwright walk, no console errors).

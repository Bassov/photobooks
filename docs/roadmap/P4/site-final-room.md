# site-final-room

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-room

## Scope

Designer Spec `personal-site` "Prod changes" P5 (D36, D40, D41, D42): the prod book page becomes the kit's reading room (`uikit/src/features/site-book/{room,reader,slides,turn}`), on top of P2 data, P3 GL and P4 home.

- [ ] `src/site/SiteRoom.tsx` replaces `SiteBookPage.tsx` and `SiteStage.tsx`: desktop reader, phone page turn (`?reader=carousel` → carousel), foot row (about · pager · Share · Fullscreen · Play), "All books"; Share per D36 (text button, "Copied" 2000 ms, no width change, `aria-live="polite"`); Fullscreen (desktop only) opens `SiteLightbox` on the view's spread and closes back to it with no turn and focus on Fullscreen.
- [ ] `src/site/book/{reader,slides,turn}.tsx` + CSS ported from the kit; phone slides per D40.
- [ ] `src/site/startSite.tsx`: D41 navigation (home click opens the room over the home, pushes the book URL, reads `book.json` prefetched on pointerenter / focus; Back / Esc / "All books" return with one history step; a direct book URL opens at the cover with "All books" a plain link; `#pN` deep links).
- [ ] `renderSitePage.tsx`: book prerender per D42 (room, CSS closed cover, foot row); `site.css` / `siteViewer.css` dropped.
- [ ] Tests: unit (`SiteRoom`, `siteModel`, `startSite`, `ShareButton`), e2e selectors moved to the room, `site-final.spec.ts` room checkpoints at 1440×900, 1920×1080, 390×844 (portrait + landscape), no-WebGL CSS reader, history, `#p4`; `site-reader-gl.spec.ts` (kit T1/T2, skip without WebGL2).
- **Browser check:** `/site.html` → click a book → room fades in, cover turns; Share reads "Copied"; Fullscreen opens the lightbox; Back returns home; 390×844 page turn.

## Done when

Room matches the Spec checkpoints at the three viewports (±0.5 px; paint check for the foot row and the page); Share / Fullscreen / history covered by e2e; page turn ≥ 58 fps median, zero LoAF > 50 ms from our code (PERF_BUDGETS unchanged); site entry ≤ 200 KB script with three only in the lazy chunk; unit + changed e2e, typecheck, lint, knip green; PR body lists before / after numbers.

# personal-site-kit-demo

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item personal-site-kit-demo
Status: done

## Scope

Item K2 of the Designer `personal-site` Spec (Owner ask 2026-11-11 18:59): the kit's personal site (K1, #558) gets the
two prod site features the stand lacks (Share, Fullscreen, D36) and becomes the site in the kit `#/demo` (D38). Kit-only.

- [ ] `uikit/src/features/site-book/room.tsx`: Share and Fullscreen per D36. Desktop foot right group `Share · Fullscreen · Play`, gap 24. Phone: header row, Share 20 px left of Play (landscape phone: Share 20 left of Play wherever Play sits); no Fullscreen on phones. Stand text buttons (`t16 g ss-tx` / `m15 g ss-tx`). Share shows "Copied" for 2000 ms with no width change (both labels in one grid cell). Fullscreen opens the existing kit lightbox (`site-lightbox`, double-click zoom). Test ids `site-share`, `site-fullscreen-btn`
- [ ] `uikit/src/demo-parts/site.tsx`: `DemoSite` and `DemoSitePreview` render `SysSite` / `ReadingRoom` from the session's published books through a new adapter `uikit/src/demo-parts/siteBooks.ts` (D38: kit spreads → `{template, photos}`, title from the book); unit test for the adapter
- [ ] `uikit/scripts/demo-capture.mjs` steps: `site-catalog` = bookcase home; `site-book` = `c('[data-testid="book3d"]')` (room at the cover); `site-share` = `c('[data-testid="site-share"]')` (Copied state); `site-fullscreen` = `c('[data-testid="site-fullscreen-btn"]')`; Preview = the room. Demo baseline PNGs regenerated for these steps
- **Browser check:** kit `#/full/personal-site?books=6&book=lake-trip` at 1440×900: the foot right group reads Share · Fullscreen · Play; Share → "Copied" for 2 s; Fullscreen opens the lightbox. At 390×844 the phone header has Share left of Play, no Fullscreen. Kit `#/demo` Publish → Open site shows the bookcase of the published books.
- **Done when:** K1 checkpoints still hold (`e2e/kit-personal-site*.spec.ts` green: room foot top 846, pager centre 720, Play right 1416 at 1440×900; room header y 128.25 at 390×844); new e2e asserts desktop Share right + 24 = Fullscreen left and Fullscreen right + 24 = Play left (±0.5 px), phone Share right + 20 = Play left and `site-fullscreen-btn` count 0 at 390×844, Share width equal before / after the click with "Copied" then back after 2000 ms, Fullscreen opens the lightbox (paint check: lightbox image pixels visible); `#/demo` site and preview steps show the bookcase / room built from the session's published books (e2e: book titles in the case equal the session's published titles); demo baselines regenerated; uikit qa green; changed e2e green 10× burn-in
- **Hard nos:** no `src/**` (prod), `.github/workflows/pr-policy.yml`, `uikit/src/features/site-viewer.tsx`, `uikit/src/features/site-photographer.tsx`, settings Site rows (K3); no backward compat (Owner 2026-11-02)
- **Test:** Playwright e2e (paint via clipped screenshots); the adapter's unit test runs in Playwright's Node runner (kit code has no vitest); uikit typecheck + qa
- **UI kit:** `uikit#/feature/personal-site`
- **Source:** Designer Spec `personal-site` (orch `shared/design/personal-site/spec.md`): D36, D38, "Test ids", "Checkpoints", "Kit changes" K2

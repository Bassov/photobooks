# promo-carousel-stills

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-carousel-stills
Status: done

## Scope

Instagram carousels step 1 of 2 (Owner Q-31, 2026-11-26: 8 feed + 8 Stories slides, English copy, "Swipe →" on slide 1). This item adds a stills pass to the promo capture so the next item (`promo-carousel-render`, `promo/carousel.mjs`) can compose the slides from real, licence-clean product stills. Source: Designer spec `promo-carousel/spec.md` («Tooling → Stills», Feed / Stories tables).

- [ ] `node promo/capture.mjs --stills [16x9|9x16 …]` walks the same scenes with the HI_SWAP CC0 photos in a browser at `--force-device-scale-factor=3` and saves one lossless PNG per scene at its end-HOLD frame to `promo/out/stills/<16x9|9x16>/NN-<scene>.png`; no clip encoding in this mode
- [ ] Stills per format: 02 photos added (filmstrip "Photos · 20", cover above), 03 photo dropped in its frame (layout pill), 04 Fill book popover over a filled spread, 05 cover "Lake trip 2026", 06 site shelf (desktop `books=12` at 1440, phone 390), 07 open book reader (desktop GL open + 1 turn; phone), 08 cover for the end card; scene 1's collage is built by the render step from p01–p21
- [ ] `promo/out/stills/stills.json` lists per file: format, scene, width, height, DSF (read back from the PNG)
- [ ] `promo/README.md`: the `--stills` mode, output table, run time
- [ ] Clip mode (no flag) keeps working unchanged
- **Browser check:** the stills show each beat; no `photos/hi/*` or fog photo in any still (the capture server's served-photo log)
- **Done when:** `node promo/capture.mjs --stills` writes 7 PNGs per format at DSF 3 (16:9 editor 4320×2700); the PR body lists the sizes from `stills.json`, how the HI_SWAP check was made and the clip-mode run time; PNGs / videos are never committed (`promo/out/` gitignored)
- **Hard nos:** only `promo/capture.mjs`, `promo/README.md` and this item change; no edits under `promo/motion/**`, `promo/carousel.mjs`, `uikit/`, `src/`, `e2e/`, `package.json`, the lockfile; no new dependency

# promo-carousel-render

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-carousel-render

## Scope

Instagram carousels step 2 of 2 (Owner Q-31, 2026-11-26: 8 feed + 8 Stories slides, English copy, "Swipe →" on slide 1). Compose the final slides from the real stills that `node promo/capture.mjs --stills` writes (`promo-carousel-stills`). Source: Designer spec `promo-carousel/spec.md` (Feed / Stories tables, Layout px, Safe zones, Tooling → Compositor, Assets) and its `sheet.mjs` data table.

- [ ] New `promo/carousel.mjs` (Node, workspace playwright-core, kit Inter / Lora woff2; no new dependency): one HTML page per slide at 1080×1350 (feed) / 1080×1920 (Stories), DPR 1, element screenshot → `promo/out/carousel/{feed,stories}/NN-<beat>.png`; the slide list and crop boxes are a data table in the file
- [ ] Copy in English, exactly the Spec tables: feed slide 1 has the "Swipe →" chip, Stories frame 1 does not, Stories frame 7 is two lines; end card "photobooks · link in bio" (feed) / "Tap the link" + an empty sticker area (Stories); no URL
- [ ] Slide 1 collage only from CC0 p01–p21; every other visual is cropped from `promo/out/stills/<format>/*.png`, never from the Designer's mockup PNGs
- [ ] The script asserts by DOM boxes: Spec layout numbers (title left / top, window box, radius, chip position), feed titles end at x ≤ 1020, no text or framed window in the safe zones (feed: 60 px sides, top-right 200×120; Stories: 250 top, 340 bottom, 60 sides); every crop upscale ≤ 1.1× (crop CSS width × 3 ≥ 0.9 × box width); Inter / Lora loaded (`document.fonts.check`) before each screenshot; it exits non-zero on a violation
- [ ] Missing stills: the script says to run `node promo/capture.mjs --stills` first and exits non-zero
- [ ] `--sheet` writes `promo/out/carousel/contact-sheet.png` (all 16, labelled)
- [ ] `promo/README.md`: a "Carousels" section (command, outputs, run time, post caption + alt text from the Spec)
- **Browser check:** the contact sheet shows all 16 slides with the right copy; no `photos/hi/*` or fog photo in any slide (the compositor's request log)
- **Done when:** `node promo/capture.mjs --stills && node promo/carousel.mjs --sheet` writes 8 feed PNGs at 1080×1350 and 8 Stories PNGs at 1080×1920 (sizes read from the PNG headers, listed in the PR body with the measured layout numbers); PNGs are never committed (`promo/out/` gitignored)
- **Hard nos:** only `promo/carousel.mjs`, `promo/README.md` and this item change; no edits under `promo/motion/**`, `promo/capture.mjs`, `uikit/`, `src/`, `e2e/`, `package.json`, the lockfile; no new dependency

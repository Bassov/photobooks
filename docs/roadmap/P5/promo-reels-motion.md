# promo-reels-motion

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-motion

## Scope

Part R0b of the Designer item `promo-reels-shared` (spec: orch `shared/design/promo-reels-3/spec.md` §0–§2, §6, §7;
Owner ask 2026-11-27 binding). Shared Remotion layer, audio synth and render/check script for three Instagram Reels.
R0a `promo-reels-capture` owns `promo/reels/**`; this item uses small fixture inputs until it merges.

- [ ] `promo/motion/src/reels/shared/`: Camera, Cursor, Grain, Focus, Background, Springs, PdfSheet (geometry from
      `src/core/pdf/pdfGeometry.ts`, read only), Phone, EndCard (mockup.json values, §2 text byte for byte), beats.
- [ ] `promo/motion/scripts/reels-audio.mjs`: code-generated music + SFX on each reel's beat grid (A 100 BPM / 18 f,
      B 90 / 20 f, C 128.57 / 14 f); no samples.
- [ ] `promo/motion/scripts/reels-render.mjs --reel a|b|c`: prepare → audio → render (H.264 CRF 16, yuv420p,
      AAC 192k) → poster → 0.5 s sheet (cells 270×480) → checks 1–8 of spec §7, exit 1 on any failure.
- [ ] `promo/motion/src/Root.jsx`: register ReelA|B|C + ReelSheetA|B|C (placeholder reel stubs).
- Off limits: `promo/reels/**`, `Promo.jsx`, v1/v2 `render.mjs`, `promo/capture.mjs`, `promo/carousel.mjs`, `src/`,
  `uikit/`, `e2e/`.
- **Browser check:** N/A (promo tooling; the smoke render + checks are the evidence).

## Done when

1. Each check of spec §7 items 1–8 is implemented in `reels-render.mjs` and shown to fail on one deliberately bad
   fixture (listed in the PR body).
2. A smoke render of a placeholder composition with the end card passes checks 1, 4, 6, 8; end card text equals §2
   byte for byte.
3. `reels-audio.mjs` writes a WAV per reel whose onsets sit on the beat grid (check prints max offset in frames: 0).

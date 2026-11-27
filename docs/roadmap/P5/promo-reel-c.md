# promo-reel-c

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item promo-reel-c
Status: done

## Scope

Reel C «Без ожидания» of the Designer feature promo-reels-3 (spec §5), stacked on #740 (capture layer).

- [x] Capture walks `promo/reels/walks-c.mjs` (spread into `capture.mjs` `CLIPS`), shot table `c.shots.js`, `ReelC.jsx`,
      registered in `Root.jsx` for reel `c`.
- [x] `node promo/motion/scripts/reels-render.mjs --reel c` exits 0 (spec §7 checks 1–8); `reel-c.mp4`, `reel-c.jpg`,
      `reel-c-sheet.png` published to the shared promo reels dir.
- [x] Spec §7.9 self-check answered with frame times in `RESULT-c.md`; all eight answers yes.
- **Browser check:** none (promo render only, no product UI change); the 0.5 s sheet is the visual check.

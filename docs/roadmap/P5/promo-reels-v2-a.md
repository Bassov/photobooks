# promo-reels-v2-a

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-v2-a
Status: done

## Scope

Reel A v2 «Одна поездка» (Designer promo-reels-v2 §4 item 3, lane promo): rebuild `ReelA.jsx`, `a.shots.js` (+ the
a-walks and `a.capture.js`) on the v2 shared layer (G1–G8) and the v2 sound (Walking Away, hero frame 177 of 530);
wire reels-mix check 12 into `reels-render.mjs` for reel A; render and pass the checks. Outputs (not committed):
`shared/promo/reels/v2/reel-a.{mp4,jpg}`, `reel-a-sheet.png`, `RESULT-a.md`.

- [x] reel-a.mp4 is 1080×1920, 30 fps, 15–20 s, H.264 + AAC, SAR 1:1; a poster JPG; a contact sheet of stills every
      0.5 s, all self-checked.
- [x] `reels-render.mjs --reel a` passes checks 9–12 (and 1–8); RESULT-a.md lists track, author, licence, credit
      line, 2 runner-ups and the measured numbers.
- [x] The PR body carries the numbers of checks 9–12 and what was not checked.
- **Browser check:** n/a (promo render; the 0.5 s contact sheet is the visual check).

# promo-reels-v2-b

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-v2-b
Status: done

## Scope

Promo Reels v2 item 4 (Owner 2026-11-27, Designer `promo-reels-v2/spec.md` §1–§5 on top of `promo-reels-3/spec.md` §4 B; Q-36 v1 reel C sets the pacing, Q-37 CC0 / CC BY tracks only): reel B «Один снимок» rebuilt on the v2 shared layer (G1–G8) and the v2 sound (Tetrapod, cover drop on the lift bar, frame 158 of 552). Tooling only under `promo/`; stacked on #740, #744, #745 (and v1 #742, which it supersedes). No product, kit, e2e or OpenSpec changes.

- [ ] `promo/motion/src/reels/ReelB.jsx`, `b.shots.js` (+ `b.beats.js`) and `promo/reels/walks-b.mjs` cut reel B to the Tetrapod grid: every cut on a beat, the cover drop on frame 158, a cut + impact on frame 236 over the track's break, the end card on the last downbeat
- [ ] `promo/motion/scripts/reels-render.mjs` mixes a v2 table's cues with `reels-mix.mjs` and runs check 12 once per render; check 7 accepts that mix byte for byte
- [ ] `node promo/motion/scripts/reels-render.mjs --reel b` exits 0 with checks 1–12; `reel-b.mp4` (1080×1920, 30 fps, 15–20 s, H.264 + AAC, SAR 1:1), `reel-b.jpg`, `reel-b-sheet.png` published to `shared/promo/reels/v2/`
- [ ] `shared/promo/reels/v2/RESULT-b.md` lists track, author, licence, credit line, two runner-ups and the numbers of checks 9–12
- **Browser check:** none (promo tooling; the render's checks and the 0.5 s contact sheet stand for it)

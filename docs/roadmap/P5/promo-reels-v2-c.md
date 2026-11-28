# promo-reels-v2-c

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-v2-c
Status: done

## Scope

Promo Reels v2 item 5 (Designer `promo-reels-v2/spec.md` §2–§5, Owner Q-36 / Q-37): reel C «Без ожидания» rebuilt on the v2 shared layer (G1–G8) and the v2 sound. v1 reel C is the reference for pacing, structure and feel. The track is the gate's pick: HoliznaCC0 "Warm Fuzz" (CC0, 126.51 BPM, 9 bars, 512 frames, lift bar 3); the hero beat is Fill book's Enter on frame 171 (b12). Tooling only under `promo/`; stacked on #740, #744, #745 and v1 #743. No product, kit, e2e or OpenSpec changes.

- [x] `promo/reels/walks-c.mjs`: v2 clip set `c-open, c-drop, c-layouts, c-fill, c-cover, c-print, c-shelf` (big strip thumbs, `geom:photo` targets, no Undo, the shelf take at `books=30` with the teaser turn and the breath drag)
- [x] `promo/motion/src/reels/c.shots.js`: the Warm Fuzz grid embedded (checked against `c.beats.json`), 12 shots cut on its beats (Md M Md M W M Md M W M Md end), v2 cue types, `sound` = the reels-mix cue list
- [x] `promo/motion/src/reels/ReelC.jsx`: G2 ground with the shot photo, G4 focus (no focus on W / sheet), G5 drag cards, PDF sheets ≥ 880 px wide, G7 `EndHero` end book, G8 `Finish`; no band masks, no `background: 'black'`
- [x] `promo/motion/scripts/reels-render.mjs`: reel C renders on the reels-mix mix and runs check 12 (`checkSoundFiles`)
- **Browser check:** none (no product UI); the outputs are self-checked from the 0.5 s contact sheet
- **Done when:** `reel-c.mp4` is 1080×1920, 30 fps, 15–20 s, H.264 + AAC, SAR 1:1 with poster and 0.5 s sheet; checks 9–13 pass for reel C; `RESULT-c.md` lists the track, author, licence, credit line, the 2 runners-up and the measured numbers; the PR body gives the numbers of checks 9–12 and what was not checked
- **Hard nos:** no edits to other reels' files, `shared/*.jsx`, `beats.js`, `sound.json`, `sound.mjs`, `reels-mix.mjs`, `promo/reels/photos.mjs`, `src/`, `uikit/`, `e2e/`, `openspec/`; no media committed; no paid track

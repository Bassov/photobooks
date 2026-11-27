# promo-reels-v2-core

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-v2-core
Status: done

## Scope

Promo Reels v2 item 1 (Owner 2026-11-27 23:17, Designer `promo-reels-v2/spec.md` §2 G1–G8, §4 item 1, §5 checks 9–11; v1 `promo-reels-3/spec.md` stands where not replaced): the shared visual layer and the geometry / frame checks. Tooling only under `promo/`; reels A/B/C keep rendering with the v1 stub on this branch (their shots are items 3–5). Stacked on #740.

- [ ] `promo/motion/src/reels/shared/{Focus,Background,Camera,Phone,EndCard}.jsx` and new `shared/Finish.jsx` meet G1–G8: one scale for both axes, frame-aspect masks, focus = hard + soft dark holes, dark radial ground for B/C, motion blur above 12 px/frame + parallax/drag helpers, phone 700×1482 at 672/390, end-card book box 860×606 + opsz Inter + per-reel scrim, vignette + v2 grain
- [ ] `promo/reels/capture.mjs`: every frame asserted at viewport × DPR (SAR 1:1), `geom:handle` / `geom:page` rects on every clip, site theme per reel (Dark for B/C if the kit has one, else Light); `CLIPS` table shape unchanged
- [ ] `promo/motion/scripts/reels-render.mjs`: checks 9 (static geometry), 10 (handle / page pixel aspect), 11 (black bands, photo share, frame 0, end-card hero width) with their numbers in `reel-x-checks.json`; CRF 14 preset slow; `--music <file>` hook; `promo/reels/README.md` documents the contract
- **Browser check:** `node promo/motion/scripts/reels-render.mjs --reel a` renders the v1 stub and prints checks 1–11 with numbers
- **Done when:** `--selftest` shows a 120-row black band failing G2, a 1.1 w/h handle failing check 10 and a `scaleX(1.2)` element failing check 9 (and their good twins passing); `--reel a --checks-only` prints checks 9–11 on the v1 composition, its expected failures listed in the PR body; no `scaleX/scaleY/matrix3d/skew/object-fit: fill|contain` in `shared/**`, PR body lists G1–G8 with file:line
- **Hard nos:** no edits to `promo/reels/sound.*`, `reels-mix.mjs`, `shared/beats.js`, `promo/motion/package.json`, `reels-audio.mjs`, `Reel*.jsx`, `*.shots.js`, `walks-*.mjs`, `Root.jsx`, `src/`, `uikit/`, `e2e/`, `openspec/`, `promo/reels/photos.mjs`; no new dependency

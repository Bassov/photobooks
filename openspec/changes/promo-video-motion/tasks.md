## Implementation

- [x] 1. `promo/motion/` project: `package.json`, lockfile, `.gitignore` (Remotion 4.0.547 pinned; `pnpm -C promo/motion audit --prod` clean)
- [x] 2. `Promo16x9` / `Promo9x16` compositions: 8 scenes from one table, Spec captions word for word, Spec layout values, fonts, header owner name covered (`src/Promo.jsx` `SCENES`, `LAYOUT`, `CUTS`, `MASKS`)
- [x] 3. `Sheet16x9` / `Sheet9x16` contact-sheet compositions + text-box logging (`TEXT_BOX` → `text-boxes.json`)
- [x] 4. `scripts/render.mjs`: stage inputs, render MP4s + sheets, probe and safe-zone checks (exit 0 on the 2026-11-26 capture; both MP4s 15.000 s, 30 fps)
- [x] 5. Music: Pixabay (bot check) and FreePD (closed) not reachable from the dev box → silent render, `music` slot documented
- [x] 6. `promo/motion/README.md`: run steps, licences, what each scene uses

## Manual test scenarios

1. Fresh capture (`pnpm uikit:build && node promo/capture.mjs`), then `pnpm -C promo/motion render`: both MP4s and both sheets written; probe lines show 1920×1080 / 1080×1920, 30 fps, 15.0 s.
   OK (2026-11-26): capture 917 s at load ~40; render exit 0; `probe: promo-16x9.mp4 1920×1080, 30 fps, 15.000 s, h264`, `probe: promo-9x16.mp4 1080×1920, 30 fps, 15.000 s, h264`.
2. Each sheet shows scenes 1–8 in order with the English captions; no sample owner name visible.
   OK: both sheets read scene by scene; full-size stills of scene 7 (frames 375 / 394–400) show no author line; site header off-frame / cropped.

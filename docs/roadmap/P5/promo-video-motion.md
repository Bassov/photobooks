# promo-video-motion

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item promo-video-motion

## Scope

Promo video step 2 of 2 (Owner 2026-11-26 19:12): a 15 s product promo for social in 16:9 (1920×1080) and 9:16 (1080×1920), built in Remotion 4 from the clips `promo/capture.mjs` records (#734). Source: Designer spec `promo-video/spec.md` («Script», «Layout values», «Assets and licences»). All on-screen text in English, word for word from the Script table (Owner 2026-11-26 20:08).

- [ ] New self-contained Remotion project `promo/motion/` (own `package.json` + lockfile, not a pnpm workspace package, installed with `pnpm -C promo/motion install --ignore-workspace`); `node_modules` and render output gitignored by `promo/motion/.gitignore`
- [ ] Compositions `Promo16x9` and `Promo9x16`: 30 fps, 15 s, the 8 Script scenes with the Spec timing (cuts on 0.5 s beats) and «Layout values» (title positions, window radius 24 + shadow, 9:16 safe zone 220 top / 400 bottom / 120 right, phone card 190,560 700×1000 r56)
- [ ] Inputs: `promo/out/clips/<format>/*.webm` (0.5 s handles trimmed) + `promo/out/stills/<format>/08-end-cover.png`; scene 1 collage from CC0 p01–p21 only; fonts Inter + Lora from `uikit/src/fonts` (OFL); the site header's sample owner name cropped or covered
- [ ] `pnpm -C promo/motion render` → `promo/out/video/promo-16x9.mp4`, `promo-9x16.mp4` (H.264, yuv420p, ≤15.5 s) + one contact sheet PNG per format (8 frames, one per scene)
- [ ] Music: a royalty-free, no-attribution 120 BPM piano / lo-fi track with source URL + licence link in the README; if none can be fetched, render silent and document the `music` slot
- [ ] `promo/motion/README.md`: run steps, licence notes (Remotion licence: free for individuals / ≤3-person companies; music; photos; fonts), what each scene uses
- **Browser check:** the contact sheets (`promo/out/video/*-sheet.png`) show all 8 scenes in order with the English captions
- **Done when:** both MP4s render locally from a fresh capture: 1920×1080 and 1080×1920, 30 fps, 14.5–15.5 s (ffprobe numbers in the PR body); every caption matches the Spec table word for word (listed in the PR body); no text inside the 9:16 safe-zone margins (measured title boxes in the PR body); no file outside `promo/motion/`, this item, `docs/roadmap.md` and its OpenSpec change changes; product build, lint and unit tests unaffected
- **Hard nos:** no edits to `promo/capture.mjs`, `promo/README.md`, root `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`, `uikit/`, `src/`, `e2e/`; no paid service; no welcome fog photo or `photos/hi/*`; never commit video, frames or PNGs

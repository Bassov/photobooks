## Decisions

1. Remotion 4.0.547 in `promo/motion/`, own lockfile, `--ignore-workspace`. Sources `.jsx` / `.mjs`: root eslint types only `*.{ts,tsx}`, and CI never installs this folder. No gate config edits: knip, patch coverage, vitest, tsc and depcruise scan only `src/`, `e2e/`, `scripts/`; prettier formats the sources.
2. Security: deps pinned, never imported by the product; `pnpm -C promo/motion audit --prod` is clean; dependency-review still sees the lockfile; Dependabot (`directory: /`) skips it. Inputs and output stay in gitignored `promo/out/`.
3. `scripts/render.mjs` copies clips, end-cover stills, CC0 `p01–p21` and Inter / Lora woff2 into `promo/out/motion-public/`, bundles once, renders both MP4s (H.264, yuv420p, 450 frames) and a 4×2 contact-sheet still per format (`<Freeze>`d scene frames). Missing inputs exit 1.
4. One `SCENES` table drives both formats: captions, frames, clip, trim past the 0.5 s handle, playback rate or beat cuts. Layout constants per format from Spec «Layout values».
5. Checks in render: title boxes logged from the sheet render (`onBrowserLog`) to `title-boxes.json`, exit 1 if a 9:16 box enters the safe zone; `getVideoMetadata` must give the size, 30 fps and 14.5–15.5 s. Site header (owner name) is covered or cropped.
6. Music: optional `promo/out/music/track.mp3`; absent → silent render, documented slot.

## Touch-set & Test Plan

| Path                              | Why               |
| --------------------------------- | ----------------- |
| `promo/motion/package.json`       | deps, scripts     |
| `promo/motion/pnpm-lock.yaml`     | lockfile          |
| `promo/motion/.gitignore`         | ignores           |
| `promo/motion/README.md`          | run, licences     |
| `promo/motion/src/index.jsx`      | root              |
| `promo/motion/src/Root.jsx`       | compositions      |
| `promo/motion/src/Promo.jsx`      | scenes, sheet     |
| `promo/motion/scripts/render.mjs` | render and checks |

- Tests: no product tests apply; the render checks of Decision 5 exit 1 on failure; sheets reviewed by eye.

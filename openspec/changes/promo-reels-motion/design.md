## Decisions

1. Pure motion math in `.js` (`beats.js` grids/cues, `Springs.js` springs, easing, cursor glide, camera path); the
   `.jsx` layers draw it and `reels-render.mjs` checks import the same functions.
2. Shot table contract (`src/reels/<x>.shots.js`, plain data: shots with frames, scale class, camera keys, clip,
   rate, photos, cues). Until a reel item adds its table, Root and the script use `stub.shots.js` + `ReelStub.jsx`.
3. Text probe: `EndCard` logs its text boxes and any stray DOM text per frame; the script reads them via
   `onBrowserLog` (parsed as JSON only, never evaluated) for check 6.
4. `--selftest` feeds one deliberately bad fixture per check 1–8 and asserts each fails.
5. Security: dependency pinned, `promo/motion` only; scripts write only under `promo/out/reels/` (plus an explicit
   `--publish <dir>`); audio is generated, no network.

## Touch-set & Test Plan

| File                                           | Why               |
| ---------------------------------------------- | ----------------- |
| `promo/motion/src/reels/shared/Camera.jsx`     | layer             |
| `promo/motion/src/reels/shared/Cursor.jsx`     | layer             |
| `promo/motion/src/reels/shared/Grain.jsx`      | layer             |
| `promo/motion/src/reels/shared/Focus.jsx`      | layer             |
| `promo/motion/src/reels/shared/Background.jsx` | layer             |
| `promo/motion/src/reels/shared/PdfSheet.jsx`   | layer             |
| `promo/motion/src/reels/shared/Phone.jsx`      | layer             |
| `promo/motion/src/reels/shared/EndCard.jsx`    | layer + probe     |
| `promo/motion/src/reels/shared/Springs.js`     | math              |
| `promo/motion/src/reels/shared/beats.js`       | math              |
| `promo/motion/src/reels/ReelStub.jsx`          | stub              |
| `promo/motion/src/reels/stub.shots.js`         | stub              |
| `promo/motion/src/Root.jsx`                    | registry          |
| `promo/motion/scripts/reels-audio.mjs`         | audio             |
| `promo/motion/scripts/reels-render.mjs`        | pipeline + checks |
| `promo/motion/package.json`                    | dep               |
| `promo/motion/pnpm-lock.yaml`                  | dep               |

- Reuse: v1 `render.mjs` bundle/render pattern, `@remotion/fonts`.
- Tests: none on `promo/` (spec §6). Evidence: smoke render (checks 1, 4, 6, 8 green), `--selftest`, audio onset
  check (max offset 0 frames).

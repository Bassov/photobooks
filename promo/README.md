# Promo video: clip capture (step 1 of 2)

Records the real kit interactions as DPR-2 clips for the promo video. The motion step (roadmap item
`promo-video-motion`, Remotion) puts them together; it never redraws the UI. Script, storyboard and layout values:
Designer spec `promo-video/spec.md` (2026-11-26, Q-29).

This folder is not a workspace package and not part of the product build, lint budgets or CSP. It uses the repo's
Playwright (`@playwright/test`, its Chromium and its bundled ffmpeg); no new dependency.

## Run

```sh
pnpm uikit:build            # writes uikit/dist (the capture serves it)
node promo/capture.mjs      # both formats; or: node promo/capture.mjs 16x9 | 9x16
```

Run time on the dev box (WSL, 2026-11-26): about 4.5 min for both formats (16:9 ≈ 160 s, 9:16 ≈ 100 s, encode and
contact sheet ≈ 10 s). Environment: `CHROME_PATH` (another Chromium), `FFMPEG` (another ffmpeg with VP9 + mjpeg),
`PLAYWRIGHT_BROWSERS_PATH` (where Playwright's ffmpeg lives; default `~/.cache/ms-playwright`). If ffmpeg is missing:
`pnpm exec playwright install ffmpeg`.

## Output (`promo/out/`, gitignored: never commit video or frames)

| File                               | Scene (spec «Script»)                                                 | Pixels    | Length |
| ---------------------------------- | --------------------------------------------------------------------- | --------- | ------ |
| `clips/16x9/02-add-folder.webm`    | 2: Add folder… → folder picker → Choose; the filmstrip fills          | 2880×1800 | 4.50 s |
| `clips/16x9/03-drop-in-frame.webm` | 3: cursor drags a thumbnail into spread 2–3's frame                   | 2880×1800 | 3.90 s |
| `clips/16x9/04-fill-book.webm`     | 4: Fill book chip → popover → Enter; then spreads 4–5 … 10–11, 1/beat | 2880×1800 | 7.23 s |
| `clips/16x9/05-cover-title.webm`   | 5: cover with photo, "Lake trip 2026" types in at 60 ms/letter        | 2880×1800 | 4.03 s |
| `clips/16x9/06-site-shelf.webm`    | 6: personal site (12 books), pointer along the spines, face-out lifts | 2880×1800 | 3.20 s |
| `clips/16x9/07-book-turn.webm`     | 7: click → the GL book opens → one page turn                          | 2880×1800 | 4.40 s |
| `clips/9x16/02…05-*.webm`          | 2–5 in the 900×860 window of the 9:16 layout                          | 1800×1720 | same   |
| `clips/9x16/06-site-shelf.webm`    | 6: phone shelf (390 wide), one touch scroll                           | 780×1114  | 2.90 s |
| `clips/9x16/07-book-swipe.webm`    | 7: tap the face-out book → reading room → one swipe turns the page    | 780×1114  | 3.97 s |
| `stills/<format>/08-end-cover.png` | 8: the "Lake trip 2026" front cover for the end card                  | 2×        | —      |
| `contact-sheet.png`                | first / middle / last frame of every clip, decoded from the webm      | —         | —      |
| `clips.json`                       | per clip: format, scene, file, width, height, duration (read back)    | —         | —      |

All clips are VP9 webm, 30 fps, no audio. Every clip starts and ends with 0.5 s of still picture (cut handles). Scene
lengths in the spec are 1.5–2.5 s; the motion step trims. Scene 1 (the camera-roll collage) and scene 8's wordmark are
not kit UI: the motion step builds them from `uikit/dist/photos/p01–p21.jpg` and the fonts.

Sizes: 16:9 is the 1440×900 kit window at DPR 2. In 9:16 the editor scenes are filmed in a 900×860 window (the spec's
9:16 window size, so the clip is exactly 2× its placed size); the site scenes are a 390×557 phone screen (390 wide, the
700×1000 card's aspect) at DPR 2.

## How it records (and why not `recordVideo`)

Playwright's `recordVideo` cannot reach DPR 2: it receives CSS-pixel screencast frames (1440×900) and pads them grey to
the requested 2880×1800. A device-pixel CDP screencast (browser started with `--force-device-scale-factor=2`) does give
2880×1800 frames, but only 3–10 per second on the editor. So each clip is filmed frame by frame:

- the page clock (`performance.now`, `Date`, rAF time, `setTimeout` / `setInterval`, event `timeStamp`, CSS and Web
  Animations) is installed before the kit's scripts; between clips it follows real time;
- while a clip records the clock stands still and each frame moves it on by exactly 1/30 s (due timers fire in order,
  running animations step with it), then a 2× JPEG screenshot (q92) is taken;
- the frames go to ffmpeg (`image2pipe` → `libvpx-vp9`, 16 Mbit/s).

Animations are not zeroed: they play at their real speed in the clip, whatever the screenshot speed. The pointer is
drawn by a small cursor overlay (headless screenshots have none; `pointer-events: none`); phone clips use CDP touch
events and show no cursor.

The kit is served over a local http server rather than `file://`, because the site's GL book needs a module import that
`file://` blocks (`gl/three.ts` `glWanted`). The script logs `reading room: GL book` when the GL path ran.

The walk follows `uikit/scripts/demo-capture.mjs` (same selectors; welcome → library → new book "Lake trip" off camera).
Order of filming: 02, 05, 03, 04 (the cover gets its photo before the spread drops, as in the demo walk).

## Licences

- Photos: only the CC0 1.0 sample photos p01–p21 (`uikit/dist/photos/credits.json`).
- `photos/hi/*` has no entry in `credits.json` (the kit lists them in `uikit/src/kit/credits.ts`), and `hi/c18` is the
  welcome fog photo (CC BY-SA 4.0, not usable in an ad). The capture's server answers every `photos/hi/<id>.jpg`
  request with a CC0 photo, so no hi photo can appear in a clip. Swaps:

  | hi photo (kit use)                  | served as |
  | ----------------------------------- | --------- |
  | `c13` (library book)                | `p05`     |
  | `c18` (welcome fog photo)           | `p09`     |
  | `c18b` (library example "Fog" book) | `p10`     |
  | `c25` (site spreads)                | `p12`     |
  | `r2` (library book, site spread)    | `p14`     |
  | `r6` (library book)                 | `p16`     |
  | `r7` (library book, site spreads)   | `p17`     |
  | `r8` (library book)                 | `p20`     |
  | `x-tatra` (site, books=12)          | `p02`     |
  | `x-valley` (site spreads, books=12) | `p21`     |

  The welcome screen itself is never filmed (it is passed off camera).

- Fonts: Inter and Lora, OFL 1.1.
- The personal site header shows the kit's sample site owner name; the motion step crops or covers it if the ad
  should not show it.

# promo/reels: photos and kit capture for the three Reels

Shared step R0a of the Designer task `promo-reels-3` (Owner 2026-11-27): the photo layer and the real-kit capture layer
for Reels A «Одна поездка», B «Один снимок» and C «Без ожидания». The Remotion side (camera, cursor, overlays, sound,
render) lives in `promo/motion/` and reads the output described below. Everything here writes into the gitignored
`promo/out/reels/`. Nothing here touches the product, the kit sources or the v1/v2 promo (`promo/capture.mjs`,
`promo/carousel.mjs`).

## Run

```sh
pnpm uikit:build                                   # capture serves uikit/dist
node promo/reels/photos.mjs                        # licence check + download + grade (all reels)
node promo/reels/capture.mjs --list                # the walk table
node promo/reels/capture.mjs --clip a-folder-drop  # one clip (or --clip id1,id2)
```

`photos.mjs` options: `--check` (licence check only), `--reel a|b|c` (only that reel's sets), `--only L18,L4` (only
these photos), `--list <file>` (another list with the same shape), `--import <file>` (rebuild `photos.json` from a
Designer list: it adds licence, author and `checked`). Re-runs reuse the downloaded originals and merge
`manifest.json`, so partial runs add to it. The manifest is rewritten after every photo, so a killed run keeps what it
finished. `capture.mjs` exits 1 when the manifest lacks any photo `photos.json` lists for the reel's sets. Commons answers bursts with HTTP 429 and `Retry-After` (often 600 s).
The script waits and retries, so a cold full run takes a few hours. Later runs take minutes.

`capture.mjs` options: `--png` writes lossless frames (default: JPEG q 95, ≈ 1.2 MB per 3840×4320 frame). Env:
`CHROME_PATH`, `PLAYWRIGHT_BROWSERS_PATH`.

Exit codes: `photos.mjs` exits 1 on any file whose Commons `LicenseShortName` / `License` is not CC0 or public domain, on a
missing file page, or on a licence that differs from the committed one. `capture.mjs` exits 1 on any failure listed in a
clip's `failures` (see below) or any error in a walk.

## Licences (spec §2 «Photos»)

`photos.json` is the only image source, apart from the kit UI itself. It lists 87 Wikimedia Commons files, all `CC0`
(checked through the API on 2026-11-27, and again on every run). Each entry has `src`, `set`, `title`, `w`/`h` (source
px), `url` (original), `page` (file page), `licence` and `author`. Downloads use UA `photobooks-promo/1.0`.

The capture server never serves a kit photo. Every `photos/pNN.jpg`, `photos/hi/*.jpg` and the C gallery's `photos/gNNN.jpg`
is answered with the reel's graded file. Any other `photos/` or `guide/` image (the guide screenshots show p01–p21) gets a
404 and fails the clip. Every request that does not go to the local server is aborted and also fails the clip.

## What the kit is fed (spec §2 «Feeding the kit»)

| Reel | Title (served JS: `Lake trip`, `Lake trip 2026`, `Lake trip ’26` → title) | Photos (p01 = first)                   | Gallery                                                       |
| ---- | ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| a    | `Lake trip 2026`                                                          | set A, graded A                        | 20 items                                                      |
| b    | `Highlands 2026`                                                          | set B (p01 = hero L68), graded B       | 20 items                                                      |
| c    | `Desert road`                                                             | Cdesert, Csurf, Ccity, Csnow, graded C | 412 items `DSC_0001.JPG`…, 6000×4000, cycling the 47 C photos |

The site owner `Aleksandr Basov` becomes `Your Name` (plus his domains and buckets). Gallery credits are rewritten to the real
CC0 file (title, author, Commons page). After the swaps the server asserts that no served script still contains
`Aleksandr`, `Basov`, a StockSnap URL or the old title, so a kit rename fails fast.

## Output contract (read by promo-reels-motion)

```
promo/out/reels/
├── originals/<src>.jpg                    downloaded Commons originals (cache)
├── photos/
│   ├── manifest.json
│   ├── <set>/<src>.jpg                    ungraded, 4000 px long edge (never upscaled), JPEG q .92
│   ├── graded/<reel>/<src>.jpg            graded per reel, 4000 px (overlays, backgrounds, macros)
│   └── kit/<reel>/<src>.jpg               graded per reel, 2400 px (what the kit is served)
└── clips/
    ├── index.json                         { <clip>: { reel, viewport, frames, duration, ok, dir } } (merged per run)
    └── <clip>/
        ├── frames/000000.jpg …            one per frame, 30 fps, viewport × 3 px (editor/site 3840×4320, phone 1170×2532)
        ├── <clip>.json                    clip meta
        ├── <clip>.rects.json              element boxes per frame
        ├── <clip>.pointer.json            pointer per frame + events
        └── <clip>.dom.json                DOM state per frame
```

`photos/manifest.json`:

```jsonc
{
  "checked": "2026-11-27", "generated": "<ISO time>",
  "sets":  { "A": [{ "src": "L18", "file": "A/L18.jpg", "w": 4000, "h": 2667, "sourceW": 5472, "sourceH": 3648 }, …], … },
  "reels": { "a": [{ "src": "L18", "set": "A", "graded": "graded/a/L18.jpg", "w": 4000, "h": 2667,
                     "kit": "kit/a/L18.jpg", "kitW": 2400, "kitH": 1600 }, …], "b": […], "c": […] }
}
```

`w`/`h` are the pixels of the graded file. That is the limit for "no photo displayed above its source px". Reel order =
set order. C's list also holds set A (the Lake trip book on C's shelf), graded C.

All clip JSON files share `fps` (30), `dpr` (3) and `viewport` `{ name: editor|site|phone, width, height, mobile }`. All
coordinates are **CSS px in viewport space**: multiply by `dpr` for frame pixels. Frame `f` is at `t = f · 1000/30` ms
on the clip's own clock. The clock only moves when a frame is filmed, so a clip plays at exactly 1× when shown at 30 fps.

- `<clip>.json`: `{ id, reel, about, fps, dpr, viewport, frames, duration (s), pixels: { width, height },
frameFiles: "frames/%06d.jpg", title, photos: [src served during this clip], pageErrors: [], ok, failures: [] }`.
- `<clip>.rects.json`: `{ fps, dpr, viewport, targets: [{ name, sel, all? }], frames: [{ f, t, rects: { <name>: box } }] }`.
  `box` = `[x, y, w, h]`, or `null` when the element is absent. Targets with `all: true` give `[box, …]` in DOM order
  (e.g. `row` = every filmstrip thumbnail, `frame` = every frame of the current spread).
- `<clip>.pointer.json`: `{ fps, dpr, viewport, frames: [{ f, x, y, down }], events: [{ f, type: down|up|key, x, y, key? }] }`.
  The cursor is **not** in the frames. Remotion draws it from `frames`. A click is a `down` and an `up` 2 frames
  (70 ms) apart. On the phone the same path is the finger (touch events).
- `<clip>.dom.json`: `{ fps, dpr, viewport, frames: [{ f, hash, dialogs: [label], focus, bad: [string] }] }`.

**No-progress check** (spec §2 «Capture», §7.5): `bad` lists every `[role=progressbar]`, `<progress>`, `[aria-busy=true]`,
spinner (`.animate-spin`, `*spinner*`, lucide loader) and every class token / `data-*` / `aria-*` value with a
`running` word (`data-state=running`, `is-running`…) that is in the DOM on that frame. Any non-empty `bad` fails the clip: `ok: false`, one
`failures` line per frame, exit 1. The clip `selftest-running` films Print → Export on purpose and must fail.

## Capture model (spec §2 «Capture», «Real time», «Cursor»)

- Chromium at `--force-device-scale-factor=3`. Viewports: editor and site 1280×1440, phone 390×844 (mobile, touch).
  The editor runs with the spreads list (`[`) and the inspector (`]`) hidden and the dock shown. `zoomSpread(P, MD|W)`
  sets the current spread's width to 700–740 (Md) or 400–440 (W) CSS px off camera, using the kit's ×1.25 buttons and
  ×1.1 wheel steps, and asserts the result.
- Clock: the v1 frame-stepped clock (timers, rAF, `performance.now`, `Date`, event timestamps, WAAPI/CSS animations)
  advances 33.33 ms per filmed frame. Setup runs in real time and is not filmed.
- Human timing: click down 70 ms, drag 800 ms (spec range 600–900), typing 60 ms per letter. Pointer moves follow the
  spec glide: T = 180 + 120·log2(D/40 + 1) ms, minimum-jerk easing, arc sin(πt)·0.08·D, a 6 px overshoot that
  settles with spring {mass .4, stiffness 300, damping 18} (`glidePath`, exported). Finger swipes pass a flat arc
  (`bow` 0.01): the kit's page drag is dropped when |dy| > 10 px comes before |dx| > 10 px.

## Walk table

`node promo/reels/capture.mjs --list` prints it. Filmed walks:

| Clip               | Reel | Viewport | What                                                                                      |
| ------------------ | ---- | -------- | ----------------------------------------------------------------------------------------- |
| `a-folder-drop`    | a    | editor   | A3–A5: Choose in the folder picker, strip full on the next frame, photo 1 → spread 1 (Md) |
| `c-gallery`        | c    | editor   | C1: Choose on the 412-item folder, strip full, fast wheel flick                           |
| `site-shelf`       | a    | site     | A9 base: books=6, click the face-out book, the GL room opens                              |
| `phone-reader`     | b    | phone    | B8 base: tap the face-out book, the reader opens, one 1300 ms finger drag                 |
| `selftest-running` | a    | editor   | the no-progress check's deliberate failure (exit 1)                                       |

The others (`a-gl-turn`, `a-fill-book`, `a-cover-title`, `a-breath`, `b-hero-drop`, `b-hero-cover`, `b-site`, `c-layouts`,
`c-fill-undo`, `c-cover-print`, `c-shelf`) are stubs. Their walks land in promo-reel-a / b / c: add `targets`, `setup`
and `act` to the entry in `CLIPS` and drop `stub`.

## v2 geometry (promo-reels-v2 spec G1–G3, checks 9–11)

- **Clip size.** Every captured frame must be exactly viewport × DPR (square pixels); any other size fails the clip.
  `<clip>.json` and `rects.json` carry `sar: "1:1"` and `theme`. `reels-render.mjs` check 9 compares each clip a shot
  names (`ui.clip`) against `pixels` (ffprobe for webm/mp4, the first frame for a frames directory).
- **Geometry targets.** Every clip also logs `geom:handle` (`rotate-knob`, `photo-handle`, the round handles) and
  `geom:page` (`ps-paper`, `pt-sheet`, the editor's `spread-layer`) with `all: true`, on top of its own `targets`. Walks may add `geom:photo`
  boxes (visible photos) for the photo share of check 11. Check 10 maps every `geom:*` box through the shot camera
  (`ui.start` = first clip frame, `ui.rate` −1 plays backwards) and measures it in the output frames.
- **Site theme.** B and C film the site (site / phone viewports) in the kit's Dark theme if `uikit/dist` has one
  (`data-theme="procreate-dark"`), else Light as it is. Today the kit has one theme, so every clip is light. Walks keep
  their `?theme=procreate-light` URLs; `runClip` swaps the reel's theme in.
- **Composition side.** `shared/Finish.jsx` (the last layer: vignette + grain) logs `REEL_GEOM` per frame:
  computed transforms, img / video / canvas boxes vs their intrinsic size, `100% 100%` masks vs their image, and the
  boxes of `[data-geom]` (`endbook`, `phone`, `screen`, `sheet`, `page`, `handle`), `[data-photo]` and
  `[data-focus]` elements. Reels tag their photo overlays `data-photo` and wrap the end-card hero in `EndHero`
  (EndCard.jsx); B passes `reel` to `EndCard` for its darker scrim.
- **Ground and focus.** The ground (`shared/Background.jsx`) is full-frame and does not follow the camera: there is
  no ground parallax (`PARALLAX` in `Camera.jsx` has plane, cursor and drag only). Focus (`shared/Focus.jsx`) gets
  `box = null` on W, PDF-sheet and phone shots, where the ground shows in a full-width band; check 11 fails a focus
  hole on a W shot or over a `sheet` / `phone` / `screen`. UI-only shots (`uiOnly`) have no photo-share minimum.
- **Empty measures fail.** Check 10 fails when the table films UI clips but no page / end book / screen was
  measured; check 9 reports an img / video / canvas whose intrinsic size is unknown.
- **Checks.** `node promo/motion/scripts/reels-render.mjs --reel x [--checks-only]` runs 1–11 and writes
  `reel-x-checks.json` (`{ reel, music, results[{ name, ok, notes, numbers }] }`; the numbers go into RESULT-x.md).
  `--selftest` proves each check fails on a bad fixture and passes its good twin. `--music <file>` stages a track
  for promo-reels-v2-sound's mix.

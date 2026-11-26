# Promo video: motion (step 2 of 2)

A 15 s product promo for social in 16:9 (1920×1080) and 9:16 (1080×1920), composited in [Remotion](https://www.remotion.dev)
4 from the clips that `promo/capture.mjs` films (step 1, see `promo/README.md`). Script, timing and layout: Designer spec
`promo-video/spec.md` («Script», «Layout values»). Remotion only places, trims and titles the clips; it never redraws the UI.

This folder is a self-contained project with its own `package.json` and `pnpm-lock.yaml`. It is **not** a pnpm workspace
package, not part of the product build, and the product imports nothing from it. The sources are `.jsx` / `.mjs` so the root
lint (typed rules on `*.{ts,tsx}`) and CI, which never install this folder, leave them alone.

## Run

```sh
pnpm uikit:build                                   # uikit/dist (capture + sample photos)
node promo/capture.mjs                             # promo/out/clips, stills, clips.json (~5 min)
pnpm -C promo/motion install --ignore-workspace    # once; never touches the root node_modules
pnpm -C promo/motion render                        # both formats; or: render 16x9 | render 9x16
                                                   # --sheet-only: sheets + text check; --strips: cutting aid
pnpm -C promo/motion studio                        # optional: preview in Remotion Studio
```

`render` copies the inputs into `promo/out/motion-public/`, bundles once and writes to `promo/out/video/`:

| File                  | What                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `promo-16x9.mp4`      | 1920×1080, 30 fps, 450 frames (15.0 s), H.264 yuv420p, CRF 18          |
| `promo-9x16.mp4`      | 1080×1920, same                                                        |
| `promo-<f>-sheet.png` | contact sheet: one frame per scene (75 % into it), 4 × 2, scene + time |
| `text-boxes.json`     | every on-screen text box per scene, in frame pixels                    |

Checks (exit 1 on failure): each MP4's size, 30 fps and 14.5–15.5 s (read back with Remotion's ffprobe); every 9:16 text
box clear of the platform UI margins (220 top, 400 bottom, 120 right). Ad-hoc probe:
`pnpm -C promo/motion exec remotion ffprobe ../out/video/promo-9x16.mp4`. Nothing under `promo/out/` is committed.

## Scenes

Times in seconds, cuts on the 0.5 s beat (120 BPM). One `SCENES` table in `src/Promo.jsx` drives both formats; `CUTS`
sets which part of each clip plays (clip second, playback rate; the 0.5 s capture handles are skipped).

| #   | t         | Uses                                                                                 | Caption                                                                                            |
| --- | --------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | 0.0–2.0   | camera roll of CC0 `p01–p21`, −4°, drifts up 60 px/s, push-in 1.00→1.06              | Thousands of photos. / _Not a single book._                                                        |
| 2   | 2.0–4.0   | `02-add-folder.webm` in the window, window rises 40 px                               | Add a folder — / _every shot at hand._                                                             |
| 3   | 4.0–6.5   | `03-drop-in-frame.webm`, zoom 1.00→1.04                                              | Drag a photo in — / _the spread is done._                                                          |
| 4   | 6.5–8.5   | `04-fill-book.webm`, one cut per beat: popover, Enter, two filled spreads            | The whole book — / _in one click._                                                                 |
| 5   | 8.5–10.5  | `05-cover-title.webm`: "Lake trip 2026" types in                                     | Your cover, / _your title._                                                                        |
| 6   | 10.5–12.0 | `06-site-shelf.webm`: 16:9 full bleed, glides 40 px; 9:16 phone card                 | Print to PDF — / _or your own site with a shelf._                                                  |
| 7   | 12.0–13.5 | 16:9 `07-book-turn.webm` (GL page turn); 9:16 `07-book-swipe.webm` in the phone card | Like a _real book._                                                                                |
| 8   | 13.5–15.0 | `stills/<f>/08-end-cover.png` settles; wordmark, tag line, CTA pill, footer fade in  | Photobooks / A quiet place / _for your books._ / Make your first book → / photobooks · link in bio |

Layout (spec «Layout values»): 16:9 titles at 120, 110 in Lora 84 (hook 92), window 560, 330, 1360×750 (to the right and
bottom edges; the 1.6 clip loses 100 px at the bottom, or at the top in scene 2 so the filled filmstrip shows), radius 24 + the spec shadow; scenes 6 and 7 are full-bleed site shots with a 72 px title at the bottom / top centre.
9:16 titles at 80, 240 in Lora 80 (hook 88: at the spec's 92 "Thousands of photos." would reach the right safe margin), window 60, 640, 900×860; phone cards 190, 560, 700×1000, radius 56. End card:
wordmark Lora 120, tag line Lora 56 (52 in 9:16), CTA pill #232223 / #F2F2F2 Inter 500 40 px, padding 28 44, footer Inter 30
#535152. No URL yet: the domain is not chosen. In 9:16, scene 6's second line breaks once more ("or your own site / with a
shelf.", same words): at 80 px it would run into the right safe margin.

The kit's sample site owner name is never shown. In the site header: 16:9 site shots sit 120 px above the frame top
(header off-frame, scene 7 also under the paper title band); the 9:16 phone card crops the top 100 px of the phone screen.
On the book's title page (it prints the same name as author): the 16:9 cuts go from the opening cover straight into the
turn past that page; in 9:16 the swipe lands on it, so `MASKS` blurs that one line while the page lies flat.

Re-cutting after a new capture: `pnpm -C promo/motion render --strips` writes every clip as a frame grid (one frame per
0.25 s, labelled with the clip second) to `promo/out/video/strips/`; pick new `CUTS` / `MASKS` values from it, then
`render --sheet-only` for a quick contact-sheet + text-box check before the full render.

## Music slot

No track is bundled. Put a licensed MP3 at `promo/out/music/track.mp3` and re-run `render`: it plays from 0 s with a short
fade-in and fades out over the last second (`Audio` in `src/Promo.jsx`); without the file the video is silent. The spec asks
for warm piano / lo-fi at 120 BPM (piano only 0–6.5 s, rhythm from 6.5 s, one held chord from 13.5 s) with a licence for
social ads and no attribution (e.g. the Pixabay Content License). When a track is picked, record its source URL and licence
link here. On the dev box (2026-11-26) Pixabay answered with a bot check and FreePD has closed, so the first render is
silent.

## Licences

- **Remotion** (`remotion`, `@remotion/*` 4.0.547): Remotion License, source-available, not OSS. Free for individuals and
  for-profit companies of up to 3 people, commercial use included; larger companies need a Company License
  (https://www.remotion.dev/license). Owner decision Q-30: Remotion, free while the team is ≤3 people. No paid service is used.
- **Photos**: only the CC0 1.0 sample photos `p01–p21` (`uikit/dist/photos/credits.json`). Never the welcome fog photo
  (CC BY-SA 4.0) or `photos/hi/*` (the capture swaps those for CC0 photos, see `promo/README.md`).
- **Fonts**: Inter and Lora, SIL OFL 1.1 (`uikit/src/fonts/LICENSE-*-OFL.txt`); embedding them in a video is allowed.
- **Music**: none yet (see Music slot).

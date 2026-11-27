# promo-reels-capture

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-capture

## Scope

Promo Reels shared step R0a (Owner 2026-11-27, Designer `promo-reels-3/spec.md` §1, §2, §6, §7): the photo and capture layer for the three Instagram Reels A/B/C. Tooling only under `promo/reels/`; the Remotion side (`promo/motion/**`) is the parallel item `promo-reels-motion`. No product, kit or e2e changes.

- [ ] `promo/reels/photos.json`: the committed CC0 photo list (sets A, B, Cdesert, Csurf, Ccity, Csnow; source URL, file page, licence, author, size, set) with `checked: 2026-11-27`
- [ ] `promo/reels/photos.mjs`: checks each file's licence through the Commons API (`LicenseShortName` must be CC0 or public domain, else exit 1), downloads the originals (UA `photobooks-promo/1.0`), writes the 4000 px long-edge copy to `promo/out/reels/photos/<set>/<src>.jpg` and the per-reel graded copy (§2 Grade A/B/C) to `promo/out/reels/photos/graded/<reel>/<src>.jpg` (gitignored)
- [ ] `promo/reels/capture.mjs`: Playwright over the built kit (`uikit/dist`, `#/demo` and site/reader routes). Per reel it serves the kit with `photos/pNN.jpg` and `photos/hi/*` swapped for the reel's graded photos and the book title / site owner renamed, and rewrites the C gallery to 412 items. After each swap it asserts that the old strings are gone and that no p01–p21 or `hi/` original is requested. Clips are filmed at DPR 3 in tall viewports (editor and site 1280×1440, phone 390×844 touch) on a frame-stepped clock. Each clip writes PNG frames, `rects.json` (element boxes per frame), the pointer path and a DOM state log per frame. Every frame fails the clip (exit 1) if `[role=progressbar]`, a `*-running*` state or a spinner is in the DOM. Generic engine + walk table; the per-reel walks may be stubs (they land in promo-reel-a/b/c)
- [ ] `promo/reels/README.md`: how to run, the output tree, file names and JSON shapes (the contract `promo-reels-motion` reads)
- **Browser check:** a sample clip's first / last frame PNG shows the kit at DPR 3 (3840×4320 for the editor) with the reel's photos and title
- **Done when:** `node promo/reels/photos.mjs` fetches every photo, its licence check passes and it exits 0, and a non-CC0 entry makes it exit 1; `node promo/reels/capture.mjs --clip <id>` writes a DPR-3 clip with `rects.json`, pointer path and DOM log, and exits 1 when a running state is captured (one deliberate case in the PR body); the README documents the output contract and the PR body lists the output tree of a sample run
- **Hard nos:** no edits under `promo/motion/**`, `promo/capture.mjs`, `promo/carousel.mjs`, `src/**`, `uikit/**`, `e2e/**`, `package.json`, lockfiles; no kit demo photos p01–p21 or `hi/*` in any frame; no new dependency

# promo-video-capture

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-video-capture

## Scope

Promo video step 1 of 2 (Owner 2026-11-26, storyboard Q-29): record the real kit interactions as DPR-2 clips for the motion step (`promo-video-motion`, Remotion). Clips only: no Remotion, no video editing, no product changes. Source: Designer spec `promo-video/spec.md` («Script», «Layout values», «Assets and licences», «Motion step capture»).

- [x] New `promo/` folder at the repo root (not a workspace package, not in the product build, lint budgets or CSP) with `README.md` and `capture.mjs`
- [x] `promo/capture.mjs` uses the repo's Playwright against the built kit (`uikit:build`, the `demo-capture.mjs` walk; that script unchanged) and records one clip per UI scene (2–7) in 16:9 (1440×900) and the 9:16 layout, both at DPR 2, animations not zeroed: folder add, drop in a frame, Fill book, cover title, shelf hover, GL page turn (desktop) / one swipe (phone)
- [x] Output `promo/out/clips/<format>/<NN-scene>.webm` (or PNG frames if recordVideo cannot reach DPR 2, with the reason in the PR); `promo/out/` gitignored
- [x] Licences: only CC0 sample photos p01–p21; no welcome fog photo; every `photos/hi/*` photo without a `credits.json` entry is swapped for a CC0 photo inside the capture; each swap listed in the README
- [x] README: how to run, output list, timing per clip, licence notes
- **Browser check:** the contact sheet (`promo/out/contact-sheet.png`, first / middle / last frame per clip) shows each interaction happening
- **Done when:** `node promo/capture.mjs` after `pnpm uikit:build` writes every clip for both formats; the PR body lists each clip with duration and pixel size (2880×1800 for 16:9, 2× the 9:16 frame) and the total run time (target ≤5 min) and describes the contact sheet; no file outside `promo/`, `.gitignore` and this item changes; `pnpm lint` and the repo checks pass
- **Hard nos:** no edits under `uikit/src/**`, `uikit/scripts/**`, `src/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; no new dependency

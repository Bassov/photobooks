# promo-reels-v2-sound

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-reels-v2-sound

## Scope

Promo Reels v2 item 2 (Owner 2026-11-27 23:17, Designer `promo-reels-v2/spec.md` §3, §4.2, §5.12): real licensed music and recorded foley in place of the synthesised v1 sound, the track gate, the per-reel beat grid and the OfflineAudioContext mix with check 12. Tooling only under `promo/`; stacked on #740 (`fix/promo-reels-capture`). No product, kit, e2e or OpenSpec changes.

- [x] `promo/reels/sound.json`: every music track and foley file (id, title, source, licence page, download URL, licence, credit line if CC BY, `checked: 2026-11-27`, sha256), the Kenney pack, the per-reel track candidates and each sfx's cue groups (≥ 3 variants per cue type)
- [x] `promo/reels/sound.mjs`: checks each licence page for its source's licence marker (FMA pages must also name the storage file), downloads into the gitignored `promo/out/reels/sound/` (Kenney through its signed link, files pulled out of the zip without a dependency), fails on any sha256 mismatch, writes `manifest.json` and runs the track gate for A/B/C
- [x] `promo/motion/scripts/reels-mix.mjs`: track gate (onset-flux autocorrelation tempo inside A 80–110 / B 60–100 / C 108–132 or half, beat confidence ≥ 0.30, downbeat excerpt of whole bars inside 15–20 s with last third ≥ 2 dB over the first) → `<reel>.beats.json`; foley plan (seeded variants, never the same file twice in a row, ± 1 semitone, ± 1.5 dB, loudest transient on the cue frame); Chromium OfflineAudioContext mix to spec §3 (ducks, breath, intro low-pass, room send, pan, 3 ms fades, mono lows, compressor, end fade) mastered to −14 LUFS / ≤ −1 dBTP; check 12 exported as `checkSound` / `checkSoundFiles` for `reels-render.mjs` (item 3 wires it)
- [x] `promo/motion/src/reels/shared/beats.js`: beats.json grid helpers (`gridBeatFrame`, `gridCue`, `gridFrames`, `gridBarFrames`, `nearestBeatDistance`, `isOnBeat`); v1 exports unchanged
- [x] `promo/motion/package.json`: `reels:sound`, `reels:mix` scripts (no new dependency)
- **Browser check:** none (no UI); the mix runs in Playwright Chromium and the PR body lists the measured numbers
- **Done when:** `node promo/reels/sound.mjs` fetches every file with matching sha256 and a track passes the gate for each of A/B/C (BPM, confidence, rise and 2 runners-up printed); `node promo/motion/scripts/reels-mix.mjs --reel a --music <file> --cues <json>` writes the three stems with −14 LUFS ± 0.5, true peak ≤ −1 dBTP, cue onsets within ± 1 frame and no silence > 150 ms; the PR body has the licence table and what could not be confirmed
- **Hard nos:** no audio file committed; no edits to `promo/reels/capture.mjs`, `promo/reels/photos.mjs`, `shared/{Focus,Background,Camera,Phone,EndCard,Finish}.jsx`, `reels-render.mjs`, README, `Reel*.jsx`, `*.shots.js`, `Root.jsx`, `src/`, `uikit/`, `e2e/`, `openspec/`; no paid track; no new dependency

# direct-crop

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item direct-crop

## Scope

Prod part 1 of the Designer feature "direct crop" (Owner Q-18, 2026-11-20; Designer spec `walkthrough-ux-review` §A). The kit `#/demo` steps `editor-frame-selected`, `editor-photo-layer-hover`, `editor-photo-scaled`, `editor-frame-cropped-by-edge` show the target (`uikit/src/sandbox/canvas.tsx` `FrameChrome`); core op `resizeFrameKeepPhoto` is on main (#647).

- [x] Frame handles crop: the 8 handles of a selected single photo frame resize with `resizeFrameKeepPhoto` (photo fixed on the page, scaled up only when it would stop covering in Fill; Shift keeps aspect; snapping unchanged); one gesture = one history step; `resizeFrame` stays for layouts and multi-select
- [x] Content grabber (28 × 28) + photo layer (ghost .3, extent outline, 4 corner photo handles, cursors, 120 ms in / 400 ms out after > 12 px, instant under reduced motion, screen-px sizes): grabber or ghost drag pans (crop clamp), corner drag scales aspect-locked about the opposite corner (Alt: centre), Fill min = cover, Fit may shrink to fit and growing past cover switches to Fill (inspector follows); "Crop · N%" tag during a photo gesture with frame handles hidden
- [x] Hit order: photo handle → frame handle → grabber → ghost (only while shown) → frame body (move / drop-swap as today); the wheel over a selected frame keeps panning the canvas
- **Browser check:** select a full-bleed photo frame: grabber at the photo centre; hover it: ghost + outline + 4 round handles; drag the right edge in: the photo stays put; drag a corner out: photo grows aspect-locked; Fit frame grown past cover reads Fill in the inspector; each gesture is one Undo
- **Done when:** new `e2e/direct-crop.spec.ts` (edge drag keeps the image page rect ±0.5 px while the clamp is inactive; grabber pans; corner scales aspect-locked; Fit→Fill in the inspector; one undo per gesture; grabber / photo layer visible by paint; kit §A sizes, shadows, colours as computed-style asserts); existing crop specs green, changed only where §A changes behaviour (named in the PR body); `pnpm roadmap check` green
- **Hard nos:** no edits under `src/core/**`, `uikit/**`, `styles/tokens.css`, filmstrip files, `e2e/fixtures/**`, `playwright.config.ts`, `.github/workflows/**`
- **Out (next item, pinned state):** rotate chip, pinned-state photo handles / Tab focus / arrow nudge, wheel zoom in the pinned state, small-frame rules
- **UI kit:** `uikit#/demo` steps above; `uikit/src/sandbox/canvas.tsx` `FrameChrome`

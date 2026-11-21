# inspector-rotate-row

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item inspector-rotate-row

## Scope

Q-21 item 6 filmstrip-inspector-quiet, part 1 of 2 (walkthrough-polish-review Must P12; P11 Low-res chip is part 2). The Photo inspector Rotate & flip section shows four full-width pills in two rows; P12 puts them in one segmented row and saves 36 px.

- [x] Kit `uikit/src/sandbox/inspector.tsx` `PhotoRotateSection`: one `rotate-row` group h28 (90° left · 90° right · Flip H · Flip V) on the Segmented `--field` track (kit pages render no borders), transparent h24 icon-only segments, 16 px glyphs, name = `aria-label` = tooltip, pressed flip = raised pill; Straighten `mt-5` below
- [x] Prod `src/editor/PhotoRotateSection.tsx` + `FitCropSection.css`: the same row from `IconButton`s; `data-testid`s, `aria-pressed`, `aria-keyshortcuts` kept
- [x] e2e numbers that pin the old rows re-measured from the kit (r10 / r11-controls / r11-photo / r14), kit P12 measurement test in `kit-frame-style`
- **Browser check:** editor, filled frame selected, 1440 × 900: row 268 × 28 at y 523.44, four 64.5 × 24 segments with equal tops, 16 px icons, Straighten label 571.44, ADJUST title 662.78 (main 698.78); kit `#/feature/frame-selection-handles` gives the same offsets
- **Done when:** kit and prod: the 4 buttons in one 28 px row, equal tops, 16 px icons, Straighten directly below; section 36 px (±1) shorter than origin/main, prod = kit; rotate / flip behaviour, keys and focus order unchanged
- **Hard nos:** no edits to `uikit/src/sandbox/chrome.tsx`, `canvas.tsx`, `uikit/src/demo-parts/**`, `uikit/src/features/**`, `src/render/**`, `src/core/**`, `uikit/src/index.css` tokens; no loosened tolerances
- **UI kit:** `uikit/src/sandbox/inspector.tsx` `PhotoRotateSection`

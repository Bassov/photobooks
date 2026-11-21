# filmstrip-resize

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item filmstrip-resize
Status: done

## Scope

Prod part (item 2 of 2: kit, prod) of the Designer `walkthrough-ux-review` spec §B "Resizable filmstrip" (2026-11-20). Owner Q-19 2026-11-20 18:53 reverses tracker #30 (fixed 76 px thumbs). The kit (`filmstrip-resize-kit`, #645) already shows the target; prod matches it.

- [ ] `src/editor/filmstripSize.ts`: thumb height H is a number or `auto`; `auto` = clamp(76, floor(0.085 · innerHeight), 160); manual range 56 .. min(240, floor(0.5 · (innerHeight − 48)) − 64), 4 px steps; persisted per device in `localStorage["photobooks.filmstrip.thumb.v2"]` (number or "auto"); the old `...thumbHeight` key is ignored; window resize re-clamps without writing.
- [ ] `src/editor/FilmstripDock.tsx` separator on the dock top edge: 9 px hit zone (top −5 .. +4), `role=separator`, `aria-orientation=horizontal`, `aria-label="Resize photos"`, aria-valuemin 56 / valuemax / valuenow = H, cursor ns-resize; hover edge line `--input` + 36 × 4 grabber pill; drag: pill `--select` + "N px" chip 30 px above the edge only while dragging; focus-visible outline 2px #3A3839 offset 2 on the pill. Keys ↑/↓ ±8, Home min, End max, Enter / double-click = `auto`.
- [ ] `src/editor/Filmstrip.tsx` / `Filmstrip.css`: thumbs, the filename strip (H ≥ 90) and the empty-state row follow H; thumb width rule unchanged; virtualisation (`buildStridePrefix` / `spacerWidthPx` / `windowOverscanPx`) is fed with H.
- [ ] Tests: new `e2e/filmstrip-resize.spec.ts`; rewrite `e2e/design-filmstrip-fixed.spec.ts` (pinned the fixed height); `e2e/design-r3-chrome.spec.ts` filmstrip-height check only; `uikit/scripts/demo-capture.mjs` gets one step `editor-filmstrip-resized` (H 128).
- **Browser check:** prod editor at 1440 × 900: thumbs 76 px (`auto`); drag the separator up 52 px → 128 px thumbs, chip "128 px" during the drag only; reload keeps 128.
- **Hard nos:** no `src/editor/FilmstripItem*`, `src/editor/EditorShell.tsx`, `src/render/**`, `src/core/**`, `styles/tokens.css`, `uikit/src/**`, `playwright.config.ts`, `e2e/fixtures/**`.
- **UI kit:** `uikit#/demo` editor photos dock.

## Done when

- Unit: `auto` H for innerHeight 900 / 1080 / 1440 / 2160 = 76 / 91 / 122 / 160; clamp and 4 px steps; storage read / write incl. "auto" and the ignored old key; re-clamp on resize does not write.
- e2e `filmstrip-resize.spec.ts`: dragging the separator brings thumbs to the new H (DOM rect ±1 px) and the "N px" chip is visible by paint only while dragging; ↑ / ↓ / Home / End / Enter; reload keeps H; filename strip shows at H ≥ 90 and not below; scrolling a long strip still virtualises (rendered item count bounded).
- Prod look of separator / pill / chip matches the kit values in §B (computed-style asserts).
- Updated pinned specs named in the PR body with why; `pnpm roadmap check` green; item Status: done.

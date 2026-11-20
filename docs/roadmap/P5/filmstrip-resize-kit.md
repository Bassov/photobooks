# filmstrip-resize-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item filmstrip-resize-kit

## Scope

Kit part (item 1 of 2: kit, prod) of the Designer `walkthrough-ux-review` spec §B "Resizable filmstrip" (2026-11-20). Owner Q-19 2026-11-20 18:53 reverses tracker #30 (fixed 76 px thumbs). Kit only (`uikit/**` + one new kit e2e spec); prod is the later item `filmstrip-resize`.

- [x] `uikit/src/sandbox/store.tsx` `view.thumb`: number or `auto`; `auto` = clamp(76, floor(0.085 · innerHeight), 160); manual range 56 .. min(240, floor(0.5 · (innerHeight − 48)) − 64), 4 px steps; window resize re-clamps without writing; persisted in `localStorage["photobooks.filmstrip.thumb.v2"]` (number or "auto"); the old `...thumbHeight` key is ignored.
- [x] `uikit/src/sandbox/chrome.tsx` dock separator on the dock top edge: 9 px hit zone (top −5 .. +4), `role=separator`, `aria-orientation=horizontal`, `aria-label="Resize photos"`, aria-valuemin / max / now, cursor ns-resize; hover edge line `--input` + 36 × 4 grabber pill; drag: pill `--select` + "128 px" chip 30 px above the edge only while dragging; focus-visible outline 2px #3A3839 offset 2 on the pill. Keys ↑/↓ ±8, Home min, End max, Enter / double-click = `auto`.
- [x] Thumbs, the filename strip (H ≥ 90) and the empty-state row follow H; thumb width rule unchanged.
- [x] Kit e2e: new `e2e/kit-filmstrip-resize.spec.ts` (`uikit/scripts/qa.mjs` is frozen).
- **Browser check:** kit `#/demo` editor at 1440 × 900, 2560 × 1440 and 3840 × 2160: thumb rect height 76 / 122 / 160 (±1, DOM measured); separator hit by `elementsFromPoint` at its centre.
- **Hard nos:** no `src/**`, `uikit/src/sandbox/canvas.tsx`, `uikit/src/sandbox/model.ts`, `uikit/scripts/demo-capture.mjs`, `uikit/scripts/qa.mjs`, `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `e2e/kit10-crop.spec.ts`; no new `#/demo` step (the prod item adds `editor-filmstrip-resized`); no shared frame-chrome CSS edits.
- **UI kit:** `uikit#/demo` editor photos dock.

## Done when

- In the kit editor at 1440 × 900 the thumbs are 76 px high (`auto`); at 2560 × 1440 122 px; at 3840 × 2160 160 px (measured thumb rect height, ±1 px).
- Dragging the separator by −52 px from 76 gives 128 px (4 px steps), chip "128 px" visible during the drag and gone after; aria-valuenow = 128.
- Keyboard on the focused separator: ↑ +8, ↓ −8, Home = 56, End = max for the window, Enter → auto; double-click → auto.
- Paint check: `elementsFromPoint` at the separator centre hits the separator (not the canvas or a thumb).
- Reload keeps the chosen H (v2 key); a stored old `...thumbHeight` key is ignored; shrinking the window below the stored H re-clamps without changing localStorage.
- Filename strip appears at H ≥ 90 and not below.
- Changed e2e specs green locally; `pnpm roadmap check` green; item Status: done.

# direct-crop-pinned

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item direct-crop-pinned
Status: done

Direct crop, prod part 2 (Q-18, design spec `walkthrough-ux-review` §A). Part 1 (#658) shipped the keep-photo
frame-handle crop, the grabber, the photo layer with corner handles and the hit order. This item finishes §A in prod.
Visual reference: kit `#/demo` steps `editor-crop-mode` (no `uikit/` edits).

## Scope

- [ ] Rotate chip: a screen-px chip like `.spread-frame-crop-tag`, 10 px right of the rotate knob, shown only while
      rotating, text = angle ("15°"); Shift = 15° steps; snaps to 0/90/180/270 within ±2°.
- [ ] Pinned state (double-click / Crop button): photo layer stays shown with the "Crop · N%" tag and a 2 px `--crop`
      outline; frame handles hidden; grabber + 4 photo handles active; Tab cycles the 4 photo handles (focus-visible
      outline 2 px `#3A3839`, offset 2); arrows nudge the photo 1 px (Shift 10); Esc / click outside exit; the wheel over
      the frame zooms the photo only when pinned.
- [ ] Small frames + layer timing: a frame side < 40 screen px hides that side's mid handles; < 64 px no grabber; layer
      shows in 120 ms ease-out, hides 400 ms after the pointer is > 12 px outside the photo extent, instant under
      `prefers-reduced-motion`.
- [ ] Undo: one gesture (rotate, one nudge key press, one wheel zoom step) = one history step.
- **Browser check:** e2e `e2e/direct-crop-pinned.spec.ts`: chip text and position (10 ± 1 px right of the knob at two
  zooms), Shift rotate multiples of 15°, 88° → 90° snap, pinned outline 2 px `--crop`, frame handles not hit-testable,
  Tab order of 4 photo handles, ArrowRight 1 px / Shift 10 px, wheel changes crop % only when pinned, 50 × 30 px frame has
  no grabber and no mid handles on the 30 px sides; paint checks (computed style + elementFromPoint). Unit tests for the
  pure helpers (rotate snap/step, pinned key handling). `design-frame-crop-masters`, `crop-in-frame`, `kit10-crop` still
  pass.

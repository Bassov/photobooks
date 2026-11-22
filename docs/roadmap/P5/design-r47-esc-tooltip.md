# design-r47-esc-tooltip

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r47-esc-tooltip
Status: done

## Scope

Design Round 47 (Designer parity cycle-layouts p2 2026-11-22, NOT PASS), two Musts. M155/M156 (pill tooltip, pill
font) already pass and stay as they are.

- [ ] M157 (kit): Esc during a frame move in `uikit/src/sandbox/canvas.tsx` `moveFrames` cancels the drag like prod
      (`src/editor/frameGesture.ts`): the frames go back where they started, the release does nothing, no undo step,
      the layout name stays, the selection is kept. Moving frames only; resize handles are out of scope.
- [ ] M158 (prod): light RAC tooltips (`src/ui/Tooltip.tsx` / `Tooltip.css`) match the kit top-bar tooltip:
      `.pb-tooltip__box` line-height 1.4, box-shadow `var(--shadow-md)` only (no inset ring), default offset 4,
      `TooltipTrigger` default delay 300. Dark `.e7-tt` tooltips (pill ‹ ›, panel toggles) keep 6 px and their
      delay. Widths and colours unchanged.
- [ ] Tests: `src/ui/Tooltip.test.tsx` (new defaults), `e2e/kit-frame-drag-esc.spec.ts`, `e2e/design-r47-tooltip.spec.ts`.
- **Done when** (1440×900): kit spread 2–3 "Hero + two", drag a frame 40/30 px, Esc, release → frame back at its
  start (±0.5 px), undo stack unchanged, pill still "Hero + two", selection kept, with the frame selected before the
  drag and not. Prod hover on Select and Zoom out → tooltip box height 26.8 ±0.5, line-height 16.8 ±0.2, no inset
  ring in box-shadow, top = button bottom + 4 ±0.5, hidden at 250 ms, visible by 450 ms. Dark pill tooltip still
  6 px above (`e2e/cycle-layouts.spec.ts` green).
- **Browser check:** `e2e/kit-frame-drag-esc.spec.ts` + `e2e/design-r47-tooltip.spec.ts` (Chromium, 1440×900).

# design-r48-esc-resize

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r48-esc-resize

Design Round 48 (Designer parity cycle-layouts p3, 2026-11-22, M159). Kit only; M157 / M158 stay as they are.

## Scope

- [ ] Kit `#/demo` (`uikit/src/sandbox/canvas.tsx` `onHandle`): Esc during a resize-handle drag cancels the resize like prod (`src/editor/frameHandleGesture.ts`): the frame goes back to its start size and position, the release does nothing, no undo step, the layout name stays, the selection is kept, no snap lines remain.
- [ ] A plain resize without Esc still commits one "Resize frame" step.
- **Done when:** `e2e/kit-frame-drag-esc.spec.ts` has an M159 case (spread 2–3 "Hero + two", se handle +30/+20 px, Esc, release → box back at start ±0.5 px, undo label unchanged, pill "Hero + two", handles visible, no `snap-line`) and a no-Esc resize case that adds the "Resize frame" step; the M157 cases stay green.
- **Browser check:** kit `#/demo` via the e2e spec (Playwright, 1440×900).

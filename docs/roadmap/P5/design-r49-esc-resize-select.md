# design-r49-esc-resize-select

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r49-esc-resize-select

Design Round 49 (Designer parity cycle-layouts p4, 2026-11-22, M160). Prod only; M157 / M158 / M159 stay as they are.

## Scope

- [x] Prod (`src/editor/frameHandleGesture.ts`): Esc during a resize- or rotate-handle drag, then a release outside the frame, keeps the selection like the kit (`e2e/kit-frame-drag-esc.spec.ts`) and prod's own Esc on a frame move (`src/editor/frameGesture.ts` `swallowRelease`): the release click no longer reaches the pasteboard deselect. Esc still restores the frame, adds no undo step, the pill name stays.
- [x] A plain resize without Esc still commits one "Resize frame" step.
- **Done when:** a unit test in `src/editor/frameHandleGesture.test.ts` (Esc mid-resize and mid-rotate, pointerup + pasteboard click → selection unchanged, no op) and `e2e/frame-resize-esc.spec.ts` (spread 2–3 "Hero + two", se handle +30/+20 px, Esc, release outside the frame → box back at start ±0.5 px, 8 handles, frame inspector, undo label unchanged, pill "Hero + two"; plus a no-Esc "Resize frame" case) are green.
- **Browser check:** prod editor via the e2e spec (Playwright, 1440×900).

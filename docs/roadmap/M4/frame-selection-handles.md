# frame-selection-handles

Tag: feature
Milestone: M4
Title: direct manipulation

## Scope

- [ ] Select a frame; SVG handle overlay; move, resize and rotate by dragging
- **Perf:** drag / resize preview in the overlay and on the frame's `transform`; op committed at gesture end. Gate: drag a frame across a dense spread — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** move, resize and rotate a frame with handles — handles never lag behind the cursor.
- **UI ref:** `uikit#/feature/frame-selection-handles`

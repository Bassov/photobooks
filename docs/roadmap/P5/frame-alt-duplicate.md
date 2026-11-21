# frame-alt-duplicate

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-alt-duplicate

Prod editor: Alt held at the press on a frame = duplicate drag, values = kit (FC2, #686). Designer frame-copy-paste spec D2, D8,
"Alt-drag look", "Prod changes" and "Tests"; Must FC5 (last item of frame-copy-paste).

## Scope

- [ ] `src/editor/frameGesture.ts` (+ new `src/editor/frameDuplicate.ts`): session kind `duplicate`; `snapBypassed` with
      `altLatch` (true at press, false on the first pointermove without Alt; bypass = `altKey && !altLatch || !snapOn`);
      `onDragStart` preventDefault for the session; no change before the 3 px slop; clones of the selected frames at opacity .85
      with ring `0 0 0 2px var(--select)`, no handles / knob, originals unchanged without ring; Shift axis lock; release = one
      `duplicateFrames` op with the final delta, selection = new frames; Esc / lost pointer = nothing dispatched. A press on a
      selected frame duplicates the selection; on an unselected one, that frame.
- [ ] `src/editor/frameClipboard.ts`: a finished Alt-drag duplicate sets `lastDuplicate` (D8).
- [ ] `src/render/SpreadView.css`: `[data-alt-duplicate]` `button.spread-frame` `cursor: copy` (Select tool);
      `data-alt-duplicate` on `.editor-workspace` while Alt is held.
- [ ] New `src/editor/frameGesture.duplicate.test.ts`; extend `e2e/frame-copy-paste.spec.ts` (Alt-drag + Esc, undo one step).
- **Browser check:** Alt-drag a frame on spread 2: ringed clone mid-drag, +1 selected frame at the drop, one Undo; Esc adds nothing.

## Done when

1. Alt-press + drag ≥3 px on a frame shows a clone at opacity 0.85 with the select ring; release adds exactly 1 frame (+N for an
   N-frame selection) offset by the drag delta (±1 px at Fit), selected; one Undo removes it.
2. Alt press + release under 3 px = plain selection, frame count unchanged; no native drag starts.
3. Esc mid Alt-drag: frame count unchanged, no undo entry.
4. Green unchanged: e2e/layout-grids-snap-wire.spec.ts:51, e2e/parent-overrides\*.spec.ts, frameGesture.override.test.ts:175-249,
   e2e/framestyle-arrange.spec.ts:59, e2e/site-preview-mode.spec.ts:267. Alt released then pressed again mid-duplicate bypasses
   snapping (unit test).
5. Cursor is `copy` over a frame while Alt is held with the Select tool (computed style in e2e).
6. Ctrl+D right after an Alt-drag duplicate repeats the same offset (D8).

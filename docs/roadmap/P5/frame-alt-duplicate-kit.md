# frame-alt-duplicate-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item frame-alt-duplicate-kit

Kit `#/demo` editor: Alt held at the press on a frame = duplicate drag (Designer frame-copy-paste spec D2, D8 and
"Alt-drag look"; Must FC2). The kit is the design source for the later prod item FC5.

## Scope

- [ ] `uikit/src/sandbox/canvas.tsx` `onFrameDown` / `moveFrames`: Alt-press duplicate session with `altLatch` (true at the
      press, false on the first pointermove without Alt; snap bypass = `altKey && !altLatch || !snapOn`); no change before the
      3 px slop; clones at opacity .85 with the `0 0 0 2px var(--select)` ring and no handles, originals unchanged without ring;
      Shift axis lock; Esc / lost pointer = nothing dispatched; release = one "Duplicate frame(s)" step, selection = new frames.
      A press on a selected frame duplicates the whole selection; on an unselected frame, selects and duplicates it.
- [ ] `copy` cursor while Alt is held over an own frame / override copy with the Select tool.
- [ ] `uikit/src/sandbox/clipboard.ts`: `duplicateFrames` takes the drag delta; a finished Alt-drag sets `lastDuplicate` (D8).
- [ ] `uikit/scripts/demo-capture.mjs`: steps `editor-frame-alt-drag` (mid-drag) and `editor-frame-alt-dropped`.
- [ ] New `e2e/kit-frame-alt-duplicate.spec.ts`.

## Done when

1. Alt-press + drag ≥3 px on a frame in `#/demo` shows a clone at opacity 0.85 with the select ring; release adds exactly 1 frame
   (+N for an N-frame selection) offset by the drag delta (±1 px), selected; one Undo removes it.
2. Alt press + release under 3 px = plain selection, frame count unchanged (e2e/kit-parent-overrides.spec.ts:119 green unchanged).
3. Esc mid Alt-drag: frame count unchanged, no undo entry.
4. Alt pressed after the press = snap bypass as today (existing kit snap tests green unchanged); Alt released then pressed again
   mid-duplicate bypasses snapping.
5. Cursor is `copy` over a frame while Alt is held.
6. Ctrl+D right after an Alt-drag duplicate repeats the same offset (D8).

- **Browser check:** `#/demo`: Alt-drag a frame, see the ringed clone, release, Undo; Alt-drag + Esc; Ctrl+D after a drop.
- **Hard nos:** no prod `src/**` (FC5), no `uikit/scripts/qa.mjs`.

# multi-select-move

Tag: feature
Milestone: P2
Title: group move
Status: done

## Scope

- [ ] Group move: with 2 or more frames selected, a drag on the body of any selected frame (filled or empty) moves every unlocked selected frame by the same delta; arrows / Shift+arrows nudge the set; Esc mid-move puts all frames back (Designer Spec `shared/design/multi-select/spec.md` "Group move" and the Arrows / Esc bullets of "Clicks and keys")
- **Prod:** new op `moveFrames {spreadId, frameIds, dx, dy}` (locked skipped, `moveFrame` clamping, one undo step "Move N frames"); `src/editor/frameGesture.ts` (pointer move of the set, snapping the union rect), `frameHandleGesture.ts` (nudge the set, `STATUS_FRAME_LOCKED` when all are locked), `src/core/ops/transform.ts` + `applyBookOp.ts`, `bookHistory.ts` (label)
- **Perf:** one `transform: translate()` per moving frame per rAF plus the group box in the same frame; no React or book commit until pointerup.
- **Browser check:** select three frames, drag one: all three move together, one undo puts them back.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/sandbox/canvas.tsx` (group drag)
- **Musts:** group move
- **Hard nos:** no fake, dead or disabled-stub controls; no blue / teal; no layout shift or page-level H/V scroll
- **Test:** `src/core/ops/transform.test.ts` (`moveFrames`, PBT), `bookHistory.test.ts` (label), `frameGesture.test.ts`; e2e `e2e/multi-select.spec.ts`: group move is one undo step, a locked frame stays put, Esc mid-move restores all frames; 3-frame group move passes the drag-swap frame-budget gates
- **Depends:** multi-select
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`)

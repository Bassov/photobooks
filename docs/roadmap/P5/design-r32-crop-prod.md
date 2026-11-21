# design-r32-crop-prod

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item design-r32-crop-prod
Status: done

Designer parity Round 32, `walkthrough-ux-review` §A (direct crop, 2026-11-21, NOT PASS): the four prod Musts
M123–M126. Visual reference: kit `uikit/src/sandbox/canvas.tsx` (no `uikit/` edits).

## Scope

- [x] M123: while the photo layer is shown (hover / selected, not pinned) the frame is lifted above its neighbours like
      the pinned crop (`CROP_Z_BOOST`), so the ghost is not clipped and all 4 photo handles are hit-testable.
- [x] M124: one Esc in the pinned crop leaves pinned mode and keeps the frame selected (frame handles, grabber, Photo
      inspector); a second Esc deselects.
- [x] M125: in Fill, dragging a photo corner inward at cover leaves the photo unchanged (cover is the minimum, the scale
      anchors on the opposite corner).
- [x] M126: Tab in the pinned crop moves focus through the photo handles without scrolling the canvas.
- **Browser check:** e2e `e2e/direct-crop-pinned.spec.ts`: `elementsFromPoint` at the 4 photo-handle centres of a frame
  next to another frame returns the handle first + ghost pixel probe past the neighbour edge; Esc → not pinned, frame
  selected, Photo inspector, second Esc deselects; se corner dragged inward 50 px at cover → photo rect unchanged
  (±0.5 px); Tab nw → ne with `pasteboard-scroll` scrollLeft / scrollTop and frame rect unchanged (±0.5 px). Unit tests
  for the changed helpers.

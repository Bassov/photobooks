## Implementation

- [x] 1. Clear or replace the pasteboard drop session on every dragstart; read live `filled` on asset drop (`galleryDrop.ts`).
- [x] 2. Clear leftover gallery selection when a frame drag starts so a following click cannot replace with a stale filmstrip asset.
- [x] 3. Regression: stale asset session + PLC-04 swap/move/self/unplace sequence must not duplicate a photo (`Pasteboard.drop.test.tsx`).

## Manual test scenarios

1. Import several photos (optionally drag one mid-import), place four on a 4-grid, then swap → move onto empty → drop frame on itself → drag a filled frame to the filmstrip: each remaining placed photo appears once; the unplaced photo leaves its frame empty.
2. After that sequence, filmstrip still lists all imports; Placed badges match frames.
3. No page-level H/V scroll during the gestures.

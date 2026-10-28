# frame-transform-ops

Tag: prep
Milestone: M4
Title: pure free-layout math
Status: done

## Scope

- [x] Move / resize / rotate ops; align / distribute; locked frames are skipped
- **Kit components:** N/A (prep; no UI)
- **Demo:** N/A
- **Musts:**
  - Pure ops in src/core/ops/transform.ts wired through BookOp / pplyBookOp: moveFrame,
    esizeFrame,
    otateFrame, lignFrames, distributeFrames; immutable (updateSpread), same book reference when nothing changes, spread leaves its template like setFrameRect.
  - Locked frames (rame.locked === true) are skipped: the op returns the same book. Align / distribute drop locked frames from the target set (they neither move nor define the bounds).
  - Invalid input is a no-op: non-finite numbers, resize edge under MIN_FRAME_EDGE_MM, unknown ids, identical result. Rotation is stored normalised to [0, 360).
  - Unit tests per op: unlocked mutates, locked unchanged, invalid inputs.
  - No schema bump (geometry fields landed in rame-geometry-schema).
- **Hard nos:** no canvas UI; no selection handles; no pointer wiring; no schema bump; no snap / GridOverlay; no multi-select; no FrameToolbar; do not fold rame-selection-handles in.
- **Tokens:** N/A (no UI)
- **Test:** move / resize / rotate change an unlocked frame; a locked frame leaves the book unchanged; min-edge and invalid inputs no-op like setFrameRect / MIN_FRAME_EDGE_MM.
- **Depends:** rame-geometry-schema (on main). Soft: rame-selection-handles consumes these ops.

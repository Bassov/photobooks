# Proposal

## Problem

Placed photos cannot move between frames or return to the gallery. Swap and unplace exist as ops, but the editor only drops gallery photos onto frames.

## Why now

Next M1 item after `drag-place-replace`.

## Scope in

- Frame onto another frame, including another spread, swaps, or moves when the target is empty. One op per drop. A self-drop is ignored.
- Frame onto the filmstrip unplaces. The photo stays in the gallery. The Placed badge clears when that photo has no placements left.
- Keyboard: with no gallery photo selected, activating a filled frame marks the move source. Activating another frame swaps or moves. A filmstrip control unplaces that source. A selected gallery photo still places or replaces and clears the frame source.
- Native drag image. The frame payload identifies the source frame and carries no file bytes. Gallery drops stay place or replace.
- Reuse cached millimetre drop targets. `dragover` does not query layout. Hover is one attribute.

## Scope out

- Multi-select fill, and creating a spread by dropping between spreads (`multi-drop-fill`)
- Desktop file drop onto the filmstrip (`filmstrip-resize-drop`)
- Undo, crop, new scrollports, and changes to `swapFrames` / `unplaceAsset`

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: frame drag and keyboard swap, move, and unplace; badge follows placement count
- `spread-view`: one drop-hover attribute during a frame drag; payload identifies the source frame and carries no file bytes; gallery drags stay asset-id place/replace
- `frame-budget`: zoomed-out frame-drag scenario

## Success criteria

- Empty: an empty gallery has no Unplace control and no Placed badge, and activating a frame leaves every frame a placeholder
- Happy path: keyboard swap of two filled frames exchanges the images and keeps both badges; move onto an empty frame clears the source, shows the photo on the target, and keeps the badge; unplace clears the frame, keeps the photo in the filmstrip, and removes the badge when it has no other placement
- Interact: a frame drag highlights one frame at a time, and a filmstrip drop highlights the filmstrip once; no page-level horizontal or vertical scroll (filmstrip and pasteboard stay the only scrollports)
- The frame-drag scenario records zero LoAF and `dragover` p95 within budget

## Risks

- Playwright HTML drag can miss the hot path, so e2e uses the keyboard path plus a synthesized `dragover` that the perf gate measures.
- With no gallery photo selected, frame activation picks a move source. Place and replace stay unchanged when a gallery photo is selected.

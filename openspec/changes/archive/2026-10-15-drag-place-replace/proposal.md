# Proposal

## Problem

Gallery photos cannot be placed on frames. Place and replace exist as ops, but the editor has no drag or keyboard path from the filmstrip onto a spread.

## Why now

Next M1 feature after `zoom-image-tiers`. The ops are already pure. `far-zoom-lod` is not needed: the whole-book zoom gate passed in `camera-zoom-pan`.

## Scope in

- Filmstrip to an empty frame places; filmstrip to a filled frame replaces. One op per drop. The photo stays in the gallery.
- A Placed badge on a thumbnail when that asset has at least one placement.
- Keyboard alternative: select a gallery photo, then activate a frame to place or replace. With no selection, activating a frame does not change the book.
- Native browser drag image. The drag payload is the asset id only.
- Drop targets come from cached millimetre rects. `dragover` does not query layout. Hover highlight is one attribute, updated only when the target frame changes.
- Perf: drag across a zoomed-out painter fixture — zero LoAF, `dragover` p95 within budget. `pnpm perf` runs the same scenario.

## Scope out

- Frame-to-frame swap or move, and frame-to-filmstrip unplace (`drag-swap-unplace`)
- Multi-select fill and drop between spreads (`multi-drop-fill`)
- Desktop file drop onto the filmstrip (`filmstrip-resize-drop`)
- Undo history, crop, and new scrollports

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: filmstrip drag and keyboard place/replace; Placed badge
- `spread-view`: drop hover is one attribute
- `frame-budget`: zoomed-out drag scenario

## Success criteria

- Empty: with an empty gallery there is no Placed badge, and activating a frame leaves every frame a placeholder
- Happy path: two gallery photos; placing the first on an empty frame shows its image and a Placed badge on that photo; replacing that frame with the second changes the image, removes the badge from the first photo, and shows it on the second; both photos stay in the filmstrip
- Interact: dragging across a zoomed-out book highlights one frame at a time, with no page-level horizontal or vertical scroll (filmstrip and pasteboard stay the only scrollports)
- The drag scenario records zero LoAF and `dragover` handler p95 within budget

## Risks

- Playwright HTML drag can miss the hot path. The perf gate synthesizes `dragover` and measures that handler.
- Whole-book zoom mounts every fixture spread. An allocating `dragover` hit test will fail the LoAF gate.

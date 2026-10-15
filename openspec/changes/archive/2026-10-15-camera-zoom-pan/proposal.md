# Proposal

## Problem

The pasteboard is a fixed-scale list. You cannot zoom from the whole book to a photo or pan with Space+drag.

## Why now

Next M1 checkbox after `spread-templates-ui`. The virtualized pasteboard and its scroll gate already exist. Camera is the interaction they depend on.

## Scope in

- Session camera (not the document, not history): Ctrl/Cmd+wheel and pinch zoom around the pointer, `+` / `-` around the viewport center, fit spread, fit width, 100% physical size (96 CSS px per inch), Space+drag pan, and a zoom-percent indicator
- Resting pan is native scroll on `pasteboard-scroll`, including horizontal scroll when a spread is wider than the port
- Minimum zoom fits the whole stack in the port; maximum is at least 400% of physical size; the initial scale stays the current layout scale
- Perf gate: continuous zoom of the painter fixture from whole book to 400% and back — zero LoAF, wheel handler p95 ≤ 2 ms

## Scope out

- Zoom image tiers (`zoom-image-tiers`)
- Far-zoom LOD bitmaps (`far-zoom-lod`) — if the whole-book gate fails, stop; do not implement the fallback here
- Rulers, drag place or replace, crop, and history

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: fit spread, fit width, 100%, and a zoom indicator
- `spread-view`: zoom and pan; whole-book zoom may mount the fixture stack
- `frame-budget`: continuous zoom from whole book to 400% and back

## Success criteria

- Empty: a normal visit still shows three empty spreads at the current layout scale and a visible zoom indicator; the document does not grow page scrollbars; the pasteboard stays the vertical scrollport
- Happy path: 100% sets physical size and the indicator shows that percent; fit width matches the active spread's width to the pasteboard port; fit spread fits the active spread inside that port
- Interact: Ctrl/Cmd+wheel or `+` zooms toward a photo and zoom-out returns toward the whole book; Space+drag pans inside `pasteboard-scroll`; when a spread is wider than the port, horizontal scrolling happens only inside `pasteboard-scroll`, with no page-level horizontal or vertical scroll
- The zoom scenario records zero LoAF and wheel-handler p95 within budget

## Risks

- Whole-book zoom mounts all ~40 fixture spreads; if that fails the LoAF gate, this change stops and `far-zoom-lod` stays a later checkbox
- Spreads revealed by zoom-out appear when the gesture settles, not mid-wheel

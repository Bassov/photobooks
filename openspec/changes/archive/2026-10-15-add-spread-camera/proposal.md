# Proposal

## Problem

Fit spread, then Add spread, and the pasteboard jumps to the tail of the stack before the new spread is laid out. The committed zoom should stay put, and the new spread should appear inside the pasteboard after layout. The layout-scale indicator (13%) is committed zoom 1; a return to that reading after Fit spread is a zoom reset, not the specified page-role width change.

## Why now

The `add-spread-camera` checkbox is already on the M1 roadmap. Add spread already appends a one-per-page spread and tries to reveal it, but the reveal runs before layout.

## Scope in

- Add spread keeps the zoom the user already committed (including after Fit spread)
- After the new spread is laid out, that spread lies inside the existing pasteboard scrollport
- The previous spread keeps the same scale; its width may grow because it is no longer the last spread
- Playwright locks the zoom percent and the new spread's position in the pasteboard
- Empty visit, Fit spread, and Add spread stay free of page-level scroll; vertical movement stays inside `pasteboard-scroll`

## Scope out

- Page-role geometry: the new last spread stays one page; the previous last spread becomes two pages
- Camera gestures, zoom limits, image tiers, and template choices other than the existing one-per-page append
- New scrollports, filmstrip behavior, and persistence

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: Add spread keeps committed zoom and reveals the new spread inside the pasteboard after layout

## Success criteria

- Empty: a normal visit still shows three empty spreads, a readable zoom indicator at the layout scale, and no page-level horizontal or vertical scroll
- Happy path: Fit spread, remember the zoom percent, Add spread — the percent is unchanged, the new spread lies inside the pasteboard, and the previous spread's scale is unchanged (its becoming two pages wide is expected)
- Interact: the new spread is in view only after layout; scrolling stays inside `pasteboard-scroll`; the document does not gain page scroll

## Risks

- An early jump to the tail can look like a zoom reset to 13%. Committed zoom must stay either way. The failing e2e decides the mechanism: remove a real reset to 13%, or fix only the early jump
- Treating the previous spread's wider page role as a zoom bug would fight the layout spec

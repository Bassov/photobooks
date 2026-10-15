# Proposal

## Problem

A new session still opens on one hand-built spread. There is no control to pick a catalog template or to add a spread, so the editing loop cannot start a book.

## Why now

Next M1 checkbox after `pasteboard-workspace`. The four-template catalog, `applyTemplate`, and `addSpread` already exist, and the pasteboard already marks an active spread.

## Scope in

- A new session opens as three spreads: single-page first and last, two-page middle, each `one-per-page` with empty frames
- The active spread's template can be switched among full-bleed, one-per-page, 2-up, and 4-grid
- Add spread appends a `one-per-page` spread and brings it into the pasteboard scrollport
- When add spread changes another spread's page role, that spread's current template is re-applied so its frames match the new width
- A template switch re-renders only the affected spread
- Perf scenario: switch a template and add a spread — zero LoAF

## Scope out

- Camera zoom and pan, image tiers, drag place or replace
- Spread list, reorder, delete, and duplicate
- Left-panel re-template (`spread-reorder-retemplate`)

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: template choice for the active spread and an add-spread control
- `spread-view`: a normal visit shows three empty spreads, not one
- `layout-geometry`: add spread re-applies the current template on a spread whose page role changes
- `frame-budget`: template switch and add-spread scenario records zero LoAF

## Success criteria

- Empty: a normal visit shows three spreads with empty frame placeholders, the old placeholder sentence stays gone, and the document does not grow page scrollbars; the pasteboard stays the vertical scrollport
- Happy path: choosing 4-grid on the active spread paints four empty placeholders on that spread only
- Interact: Add spread raises the stack to four spreads, the new spread is inside the pasteboard scrollport, and the previous end spread shows frames from its re-applied template at the new two-page width; no page-level horizontal or vertical scroll
- A template switch does not re-render sibling spreads; the scenario records zero LoAF

## Risks

- Re-applying a neighbor template on add drops placements past the new frame count (the existing rebind rule)
- Controls inside the scrollport would change the virtualizer stride and break the fixture scroll extent
- Three spreads may overflow a short workspace; that overflow must stay inside the pasteboard

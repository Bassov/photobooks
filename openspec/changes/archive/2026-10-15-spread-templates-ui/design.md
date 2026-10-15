# Design

## Context

See proposal.md. Catalog templates, `applyTemplate`, and `addSpread` live in `src/core`. The session book is hand-built in `createSessionBook`. `Pasteboard` already marks one active slot. Spread paint subscribes per id via `subscribeSpread`.

## Goals / Non-Goals

**Goals:**

- Session book is three spreads with correct page roles
- Template choice and add-spread sit outside the pasteboard scrollport
- Add-spread re-applies a catalog template when page count changes

**Non-Goals:**

- A new store, worker, or left panel
- Regenerating frames on remove-spread

## Decisions

1. **Build the session book with three `addSpread` calls** on an empty spread list (`spread-1` … `spread-3`). The third call re-applies `one-per-page` on the new interior, so first and last stay one page (one frame) and the middle becomes two pages (two frames). Alternative: hand-written frames — drifts from the op.

2. **Re-apply only on page-count change.** After inserting the new `one-per-page` spread, compare `getSpreadPageCount` before and after for each pre-existing id. If the count changed and `templateId` is a catalog id, call `applyTemplate` with that id. Spreads with no catalog id keep identity (existing `makeBook()` add-spread test). Alternative: always rebuild every spread — breaks structural sharing.

3. **Toolbar is a sibling of the scrollport, owned by `Pasteboard`.** The Pasteboard root is a column that fills `.editor-workspace`. The bar is the first child and does not scroll. The scrollport is the second child with `flex: 1; min-height: 0; overflow: auto` — not `height: 100%`, which would overflow the column and get clipped by the workspace. `SpreadTemplateBar` reads the marked spread id and that spread's `templateId` through `subscribeSpread`. `pickActiveSpread` treats intersection ratios within 0.02 as a tie and keeps the earlier spread, so a subpixel clip does not mark the spread below as active. A radiogroup named "Spread template" has one labeled radio per catalog id (Full bleed, One per page, 2-up, 4-grid) and dispatches `applyTemplate`. An "Add spread" button dispatches `addSpread`, then sets the scrollport `scrollTop` to the end so the new spread is inside the port. Radios and the button use the same visible `:focus-visible` ring as the pasteboard. The bar is not inside a slot, so `pasteboardStridePx` and the fixture `40 * stride` extent stay put. Alternative: controls in `EditorShell` — would lift active-spread state out of the component that already owns it.

4. **Sibling paint stays on the existing subscription.** `applyTemplate` changes one spread reference; `notifyAffectedSpreads` already skips unchanged ids. Lock it with the same public `ConnectedSpreadView` profiler test used for unplace.

## Risks / Trade-offs

- [Re-apply drops placements past the new frame count] → same index rebind as `applyTemplate`; not a new rule
- [Toolbar takes workspace height] → the scrollport is `flex: 1; min-height: 0`, so it shrinks instead of overflowing; overscan is one stride, so three session spreads still mount on a desktop viewport
- [jsdom viewport height is 0] → unit tests assert `data-spread-count`, not that every spread is mounted

## Touch-set

- `src/core/ops/spreads.ts`, `src/core/ops/ops.test.ts`
- `src/editor/bookStore.ts`, `src/editor/Pasteboard.tsx`, `src/editor/SpreadTemplateBar.tsx`, `src/editor/EditorShell.css`
- `src/editor/ConnectedSpreadView.test.tsx`, `src/editor/EditorShell.test.tsx`
- `e2e/spread-view.spec.ts`

## Tests and UI

Public API: `addSpread` / `applyBookOp`, `EditorShell` / `Pasteboard` DOM (`radiogroup`, add-spread button, `data-spread-count`), `ConnectedSpreadView` render output.

Reuse `makeBook` / `makeSpread` and `assertDocumentFitsViewport`. On the add-spread path also call `assertNamedScrollport(page, 'pasteboard-scroll', { axis: 'vertical', nudgeHorizontal: false })` so the helper checks overflow without moving the new spread out of view.

E2E: empty visit shows three spreads (1 / 2 / 1 empty placeholders) and a fitting document; choosing 4-grid paints four placeholders on the active spread only; Add spread makes four spreads, the previous end spread is two-page, and the new spread is inside the scrollport. Name the LoAF scenario so `pnpm perf` (`-g frame-budget` on `e2e/spread-view.spec.ts`) runs it.

Skill `ui-review` (layout smoke included) runs before push: keyboard-reachable radios and button, no new page scroll, empty frames readable.

# Proposal

## Problem

The book document schema exists, but there is no pure layout layer: no templates that generate frames on the layout grid, no `resolveSpread` for painters, and no document ops/selectors for gallery and placement. Editor UI and painters would each re-implement geometry without a shared core.

## Why now

Next M1 prep item in `docs/roadmap.md` after `book-core-schema`. Filmstrip, pasteboard, and drag semantics all depend on templates, resolve, and pure ops living in `src/core`.

## Scope in

- Templates as frame generators aligned to the layout grid: full-bleed, one-per-page, 2-up, 4-grid
- `resolveSpread` → resolved items (rect mm, asset id, source crop rect, z) plus derived page cut lines; memoized by spread reference
- Pure ops: gallery add/remove (cascade placements), place, replace, unplace, swap, apply template, add/remove/move spread
- Selectors: placement count per asset, unplaced assets
- PBT for geometry and op invariants; `pnpm bench` budgets on a 40-spread / 1000-asset book

## Scope out

- Editor UI, filmstrip, pasteboard, drag-and-drop wiring
- Snapping engine, free-frame geometry (`frame-geometry-ops`)
- Persistence, asset hashing, workers, print profiles
- Undo/history store wiring (ops only)

## Capabilities

### New Capabilities

- `layout-geometry`: templates, spread resolution, document layout ops, and placement selectors in pure `src/core`

### Modified Capabilities

- (none)

## Success criteria

- Applying each catalog template yields frames aligned to the effective layout grid
- `resolveSpread` returns stable resolved items and page cuts; repeat calls with the same spread reference hit the memo
- Ops preserve referential invariants and structural sharing where content is unchanged
- Selectors report placement counts and unplaced gallery assets without denormalized document fields
- PBT covers geometry/op invariants; benches for resolve, ops, and selectors pass budgets on 40×1000

## Risks

- Asset records still lack dimensions — source crop rect needs an aspect-ratio lookup (default square) until assets grow later
- Over-broad op surface could bloat `src/core` — stick to the roadmap op list and keep modules small

## Decisions

1. Delete the `dismissed` state and its document Escape listener in `Inspector.tsx`. The Esc owners stay as they are (`cropGesture` exits crop, `galleryDrop` / `frameSelection` clear the selection), so the context follows the stores they write.
2. `inspectorView(book, frameSource, activeSpreadId, selection)` drops the `dismissedSpreadId` parameter. With no frame or multi selection it resolves the active spread, and the first spread when the active id is null or stale (kit `cur` is clamped, never empty). `empty` remains only for a book with no spreads.
3. No per-surface patches; the PR body lists each selection / active-spread caller.
4. Spec: fold the invariant into the existing `spread-view` "Inspector context header" requirement (the spec is at 395 of 400 lines, so no new requirement).

## Touch-set & Test Plan

| File                                     | Why                                                 |
| ---------------------------------------- | --------------------------------------------------- |
| `src/editor/Inspector.tsx`               | drop `dismissed` + Escape listener                  |
| `src/editor/inspectorModel.ts`           | resolver without dismissal; first-spread fallback   |
| `src/editor/inspectorModel.test.ts`      | resolver cases                                      |
| `src/editor/Inspector.test.tsx`          | Esc keeps Spread; null active → first spread        |
| `src/editor/Inspector.grid.test.tsx`     | old "nothing active → empty" case → first spread    |
| `src/editor/LayoutSection.test.tsx`      | old "nothing active → empty" case → no-spreads book |
| `src/editor/SpreadsPanel.cover.test.tsx` | old "nothing active → empty" case → Spread          |
| `e2e/inspector-context-paths.spec.ts`    | repro 1–3 + Hand on the painter fixture             |

- Reuse: `inspectorView`, painter fixture, `spread-list-item-*` rows, `inspector-context` / `inspector-spread-summary` test ids.
- Tests: unit (resolver: active, stale/null → first, no spreads → empty, frame and multi precedence; the empty hint is unit-only, e2e fixtures always have spreads); e2e: the four paths assert header "Spread" and the summary pages; they fail on main (empty hint).

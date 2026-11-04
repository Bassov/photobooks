## Decisions

1. `viewGuides(book, spreadIndex, spread = book.spreads[spreadIndex])` in `src/core/parentSpreads.ts` wraps `resolveParentGuides`; only `layer: 'parent'` guides (two-page mm) are mapped onto a single page per the spec delta; override copies and own guides are already in spread mm. A one-spread book maps as page 1. `parent-guides-snap` reuses it.
2. Cache like `resolveLayoutGrid`: `WeakMap` by spread object, hit on the same parent guides array, trim width, spread index and count.
3. `GuidesOverlay` subscribes with `subscribeBookStore` (as `GridOverlay`): `paintChanged` compares `parent.frames` only, so a parent guide edit repaints no child spread and the overlay needs its own subscription. `bookStore.ts` unchanged; a unit test pins it.
4. Parent line: no pointer handler, `pointer-events: none`, no hit strip, `repeating-linear-gradient` in `--parent-soft` (tokens.css, added to `docs/design.md` editor tokens), screen px. Skill `ui-review` before push.

## Touch-set & Test Plan

| File                                | Why                                    |
| ----------------------------------- | -------------------------------------- |
| `src/core/parentSpreads.ts`         | `viewGuides` + cache                   |
| `src/core/index.ts`                 | export                                 |
| `src/editor/GuidesOverlay.tsx`      | layers, store subscription             |
| `src/editor/Guides.css`             | parent look                            |
| `docs/design.md`                    | token note                             |
| `src/core/parentSpreads.test.ts`    | PBT ≥1000 runs                         |
| `src/editor/GuidesOverlay.test.tsx` | parent layer, same snapshot            |
| `src/editor/bookStore.test.ts`      | guide-only parent edit                 |
| `e2e/parent-spreads-guides.spec.ts` | display, browser check, 40-spread gate |

- Reuse: `resolveParentGuides`, `getSpreadPageCount`, `GridOverlay` pattern.

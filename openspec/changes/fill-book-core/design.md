## Decisions

1. One private `layoutFill` computes the ids (gallery-only, unplaced per `placementCountByAsset`, order kept), the E / L slots and the plan; `planFillBook` returns its plan and `fillBook` executes it, so the numbers cannot drift.
2. Empty frame = own `spread.frames` entry, `takesPhoto`, no `assetId`; master items are never read or written. Reading order: page (`rect.x ≥ trim width` → right), then `Math.round(rect.y)`, then `rect.x`.
3. Plan maths and assignment exactly per Designer "### Core"; `pagesAfter = pagesOf(n + newSpreads)`.
4. New spreads go in before the last page through `insertFilledSpread`, factored out of `insertSpreadWithAssets`, so E / L ids stay valid.

## Touch-set & Test Plan

| Path                                                            | Why                     |
| --------------------------------------------------------------- | ----------------------- |
| `src/core/ops/fill.ts`                                          | plan, op, shared helper |
| `src/core/ops/applyBookOp.ts`                                   | `fillBook` op           |
| `src/core/index.ts`                                             | exports                 |
| `src/core/ops/fill.test.ts`                                     | unit cases              |
| `src/core/ops/fillBook.pbt.test.ts`                             | PBT                     |
| `openspec/changes/fill-book-core/specs/layout-geometry/spec.md` | requirement             |

- Unit: every Designer "## Tests" case plus the 3-spread + 12-photo book and the op dispatch.
- PBT: random books, pre-placed photos and limits; placed / spread / page counts equal the plan; placed ⊆ unplaced before.
- e2e: none (no UI).

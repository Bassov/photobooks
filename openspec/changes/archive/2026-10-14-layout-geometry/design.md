# Design

## Context

See proposal.md. `src/core` already has schema, parse, invariants, and `updateSpread`/`updateFrame`. Painters and editor UI are not in this change.

## Goals / Non-Goals

**Goals:** Pure templates, `resolveSpread`, layout ops, selectors, PBT, and bench budgets beside existing core modules.

**Non-Goals:** UI wiring, snapping, print profiles, asset dimension storage, undo store.

## Decisions

1. **Modules** — Small units under `src/core/`:
   - `templates/` — catalog ids, generators, `applyTemplate`
   - `geometry/` — spread size/page cuts, crop→source rect, `resolveSpread` + memo
   - `ops/` — gallery, place/replace/unplace/swap, spreads, `applyBookOp`
   - `selectors/` — placement counts, unplaced assets
   - Extend `testing/fixtures.ts`; re-export from `index.ts`

2. **Coordinates** — Spread origin = top-left of trim. `bleedMm` / margins extend from that origin. `spreadWidthMm` = `trim.widthMm` (one-page: first/last) or `2×trim.widthMm` (interior). Height = `trim.heightMm`.

3. **Template ids and rects** — Catalog: `'full-bleed' | 'one-per-page' | '2-up' | '4-grid'`. Effective grid = spread `layoutGrid` override or book `layoutGrid`. Let `W`/`H` = spread size; `b` = `bleedMm`; margins `m*`; gutters `cg`/`rg`.
   - **full-bleed** (always 1 frame): `{ x: -b, y: -b, width: W + 2b, height: H + 2b }` (ignores margins).
   - **one-per-page**: one margin-inset frame **per page**. One-page: one frame in `[m.left, m.top, W−m.left−m.right, H−m.top−m.bottom]`. Two-page: left page uses left margins within `[0,W/2]`; right page uses right half starting at `W/2` with the same margin inset relative to that page.
   - **2-up**: **two equal columns** in the whole-spread margin-inset box, separated by `cg` (not per-page). Same frame count on one- and two-page spreads.
   - **4-grid**: 2×2 cells in the whole-spread margin-inset box using `cg`/`rg`.
     Generators assign `z` by paint order (0..n−1).

4. **Apply template** — Rebuild frames from the generator; rebind `assetId`/`crop` by **frame index order**. **Preserve frame `id`s by index** when rebuilding; mint new ids only for extra frames; drop unused ids when fewer. Sets `templateId`.

5. **Spread size / page cuts** — First and last = one page; interior = two pages. One-page: no cuts. Two-page: vertical cut at `trim.widthMm`.

6. **`resolveSpread`** — Input: book, spreadId, optional `getAspectRatio(assetId) → number` (default `1`). Output: items `{ frameId, rectMm, assetId?, sourceCropRect?, z, rotation: 0 }` plus `pageCuts`. Rotation always `0`. Source crop from cover-fit + crop when `assetId` present. **Memo:** cache structural result (items without source crops + pageCuts) keyed by spread + settings identity + `spreadCount` + `spreadIndex` (so move/add/remove invalidate page role); **always recompute source crop rects** from the current lookup so aspect changes cannot go stale.

7. **Ops** — Named pure functions plus `applyBookOp(book, Op)`. Gallery remove cascades placements. `place` no-ops (or typed-fails) if the frame already has an asset — use `replace`. `addSpread` inserts at index (or appends) and **applies `one-per-page`** so the new spread gets empty margin-inset frame(s) for its page count and `templateId: 'one-per-page'`. Refuse removing the last spread. Reuse `updateSpread`/`updateFrame`; preserve structural sharing.

8. **Selectors** — `placementCountByAsset(book)`, `unplacedAssetIds(book)`. No denormalized counters.

9. **Benches** — `*.bench.ts` for resolve, hot ops, selectors on `largeBook(40, 1000)` with asserted ms budgets (calibrate on apply).

## Touch-set

- `src/core/templates/*`, `geometry/*`, `ops/*`, `selectors/*`
- `src/core/index.ts`, `src/core/testing/fixtures.ts`, tests, benches
- `docs/roadmap.md` (nested ticks); `AGENTS.md` only if module-map note needed
- `openspec/specs/layout-geometry/` (via archive sync)

## Composition

Pure domain only — stays behind `core-is-pure`. No React entrypoint imports. Tests import public API from `src/core` (and fixtures).

## Tests

Public API: template apply, `resolveSpread`, named ops / `applyBookOp`, selectors. Fixtures: existing builders + `largeBook`. Unit + `@fast-check/vitest` PBT for op invariants and crop/geometry. No e2e.

## Risks / Trade-offs

- [Default aspect 1] → Accept; `getAspectRatio` is the seam; crops always recomputed.
- [Bench thresholds] → Calibrate on apply; catch O(n²), tolerate CI noise.

## Migration Plan

Additive pure API. Rollback = revert PR.

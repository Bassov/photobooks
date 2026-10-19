# Design

## Context

See proposal.md. `ConnectedSpreadView` already uses `thumbSnapshotFor` + `subscribeAssetIds(..., subscribeThumb)` and per-spread `tierDisplayKeyFor` (landed in PR #90). `thumbCache` still exports unused `subscribeThumbPublishes` / `getThumbPublishGeneration` from the PR #89 global path. `twoSpreadBook` places the same asset on both spreads, so the existing “unrelated asset” render test does not prove Done-when (thumb for a photo on A vs B).

## Goals / Non-Goals

**Goals:**

- Lock the per-spread thumb snapshot as the product path; remove the dead global publish API.
- Done-when render-count: distinct photos on A and B; publish A’s thumb → B idle.
- Continuous-zoom frame-budget e2e stays green.

**Non-Goals:**

- New stores, scrollports, dependencies, schema, CI/Stryker gates, HomeScreen.
- Changing filmstrip `subscribeThumb` per-item wiring.

## Decisions

1. **Keep the PR #90 snapshot** — `useSyncExternalStore` getSnapshot returns `thumbSnapshotFor(spreadAssetIds, getThumbUrl)` (stable string). Subscribe via `subscribeAssetIds` + per-asset `subscribeThumb`. Alternative: global generation again (rejected: wakes every spread).

2. **Leave unused global publish API in `thumbCache`** — `ConnectedSpreadView` must not call `subscribeThumbPublishes` / `getThumbPublishGeneration` (already true after PR #90). Deleting those exports here would put the whole `ensureThumb` race surface under `stryker:diff` below the 85% / 0 NoCoverage bar without a large test rewrite. Cleanup stays a follow-on only if knip or a caller forces it. Alternative: delete now and expand ensureThumb race tests (rejected for size).

3. **Done-when fixture** — book with asset `a` on `s0` and `b` on `s1`, no preview/tier URLs; `mountSiblingPaint`; `setThumbUrl('a', …)`; assert `s1` render count unchanged and `s0` updates. Keep the unrelated-asset case as a secondary guard.

4. **Browser / Perf on the item file** — item lacked lines; add them in this change (assumption recorded in proposal).

## Risks / Trade-offs

- [React Compiler drops a “unread” snapshot] → snapshot is an argument to `resolveSpreadPreviewUrl` in `previewUrlFor` (same as today).
- [Shared asset on both spreads] → both MUST re-render; Done-when uses distinct assets only.
- [resetThumbCache still notifies per-asset listeners] → keep that; drop only global publish fan-out.

## Touch-set

- `src/editor/ConnectedSpreadView.test.tsx` (Done-when distinct-asset render-count + empty previewUrls harness option)
- `src/editor/ConnectedSpreadView.tsx` — confirm only; no edit expected (already per-spread snapshot)
- `docs/roadmap/M2.2/spread-thumb-render-scope.md` (Browser/Perf + scope ticks)
- `openspec/specs/spread-view/spec.md` (via archive sync)
- e2e: run continuous-zoom frame-budget case; no e2e source edits unless red

No gate-config edits. No new dependencies.

## Tests

- Public API: `setThumbUrl` / `subscribeThumb` / `getThumbUrl`; snapshot helpers already unit-tested.
- Render-count Done-when as in Decision 3 (must fail if ConnectedSpreadView re-subscribes globally).
- UI lock-ins: empty = missing-spread already null (N/A new empty state); happy = Browser check + existing late-thumb ConnectedSpreadView paint test; interact = continuous-zoom frame-budget in `e2e/spread-view.spec.ts` (changed:quiet / targeted).
- Mutation: changed production code ≥85% with 0 NoCoverage (`pnpm stryker:diff`).

## Composition

Helpers stay in `spreadPreviewKeys.ts`. View only subscribes and passes the snapshot into `resolveSpreadPreviewUrl`. No new React context.

## Migration Plan

None. In-memory caches reset via existing `resetThumbCache`.

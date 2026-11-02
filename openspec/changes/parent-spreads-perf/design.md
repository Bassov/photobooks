## Decisions

1. Baseline (2× throttle, 40 spreads on Master A, 10 nudges): 0 LoAF, nudge INP 40–56 ms, of which our JS is ~4 ms per nudge (React reconcile of the 40 using spreads ~2.5 ms, store keys/lookups ~0.7 ms); the rest is style/paint and the Playwright trace snapshotter. Nothing heavy to slice; no worker.
2. `bookStore` paint cache is invalidation-driven: `getSpreadPaintSnapshot` returns the cached entry as is (no paint key built per `getSnapshot`); `notifyAffectedSpreads`, which every state transition already runs, is the only invalidator.
3. `notifyAffectedSpreads` builds one `id → { spread, parent, index }` map per book (spreads + parents as spreads) instead of `editableSpread` per id (O(N²) → O(N)). It invalidates + notifies an id when its spread, parent object (id + revision: parents are immutable) or index changed, or — only when the shared paint context changed (settings, frame styles, assets, session meta, preview URLs, spread count) — when the paint input key differs.
4. Perf gate: new e2e `frame-budget gates` scenario on `?fixture=painter&perf=1&parent=a`; the loader reads `parent=a` and sets `defaultParentId` to Master A.

## Touch-set & Test Plan

- Files: `src/editor/bookStore.ts`, `src/testFixtures/loadPainterFixture.ts`; tests `src/editor/bookStore.test.ts`, `src/testFixtures/painterFixture.test.ts`; e2e `e2e/parent-spreads-perf.spec.ts`.
- Reuse: `spreadParent`, `parentAsSpread`, `PARENT_SPREAD_INDEX`, `paintInputKey`, perf fixture helpers.
- Tests: unit — parents A/B + None, edit A → notified / re-resolved count = spreads on A + A, B / None snapshots identical; context changes (page colour, preview URL) still repaint. e2e — zero LoAF + INP budget while nudging the 40-spread parent; `parent-spreads-edit` / `kit10-masters` unchanged.

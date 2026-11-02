## Decisions

1. Baseline 0 LoAF, our JS ~4 ms per nudge: nothing to slice, no worker; the gate is a regression guard.
2. `bookStore` paint cache is invalidation-driven: `getSpreadPaintSnapshot` returns the cached entry as is (no paint key built per `getSnapshot`); `notifyAffectedSpreads`, which every state transition already runs, is the only invalidator.
3. `notifyAffectedSpreads` builds one `id → { spread, parent, index }` map per book (spreads + parents as spreads) instead of `editableSpread` per id (O(N²) → O(N)). It invalidates + notifies an id when its spread, parent object (id + revision: parents are immutable) or index changed, or — only when the shared paint context changed (settings, frame styles, assets, session meta, preview URLs, spread count) — when the paint input key differs.
4. Perf gate: new e2e `frame-budget gates` scenario on `?fixture=painter&perf=1&parent=a`; the loader reads `parent=a` and sets `defaultParentId` to Master A.

## Touch-set & Test Plan

- Files: `src/editor/bookStore.ts`, `src/testFixtures/loadPainterFixture.ts`; tests `src/editor/bookStore.test.ts`, `src/testFixtures/painterFixture.test.ts`; e2e `e2e/parent-spreads-perf.spec.ts`.
- Reuse: `spreadParent`, `parentAsSpread`, `PARENT_SPREAD_INDEX`, `paintInputKey`, perf fixture helpers.
- Tests: unit — parents A/B + None, edit A → notified / re-resolved count = spreads on A + A, B / None snapshots identical; context changes (page colour, preview URL) still repaint. e2e — zero LoAF + INP budget while nudging the 40-spread parent; `parent-spreads-edit` / `kit10-masters` unchanged.

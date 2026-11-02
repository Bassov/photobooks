## Implementation

- [x] 1. Painter fixture `&parent=a`: Master A as the book default (loader + `painterFixture.test.ts`).
- [x] 2. Perf gate `e2e/parent-spreads-perf.spec.ts` (`frame-budget gates`): 40 spreads on Master A, nudge the logo in Masters mode, zero LoAF + INP budget.
- [x] 3. `bookStore`: invalidation-driven paint cache; one id → { spread, parent, index } map per book; paint keys only when the shared paint context changed (d5d557f0).
- [x] 4. Unit: edit parent A → only A's spreads (+ A) invalidated, count asserted; B / None untouched; context changes still repaint (`bookStore.test.ts` "bookStore spread paint covers the parent layer").

## Manual test scenarios

N/A — no UI change; the e2e perf gate and `parent-spreads-edit` / `kit10-masters` e2e cover the interaction.

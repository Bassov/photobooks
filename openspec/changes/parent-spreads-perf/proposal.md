## Proposal

Roadmap: `docs/roadmap/P2/parent-spreads-perf.md` (scope / Done when / Perf SoT).

### Scope out

- React-level memo of unchanged frames inside a repainted spread.
- Masters inspector, page numbers, parent overrides UI.
- `PERF_BUDGETS` stay unchanged.

### Delta / Risk

- Paint cache becomes invalidation-driven in `notifyAffectedSpreads`; a missed transition would paint stale.
- Painter fixture gains `&parent=a` (Master A as book default) for the 40-spread gate.

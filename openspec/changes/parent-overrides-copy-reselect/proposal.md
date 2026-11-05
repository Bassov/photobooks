## Proposal

Roadmap: [`docs/roadmap/P2/parent-overrides-copy-reselect.md`](../../../docs/roadmap/P2/parent-overrides-copy-reselect.md) (scope / Done when).

### Scope out

- Kit order, inspector / context menu, parent guide override (PO5).
- `e2e/parent-overrides.spec.ts` (the reselect gets its own spec).

### Delta / Risk

- Hit order: copy → parent guide → parent frame; a copy hit adds no op or undo step.

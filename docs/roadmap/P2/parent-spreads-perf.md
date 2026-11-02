# parent-spreads-perf

Tag: feature
Milestone: P2
Title: parent spreads: edit perf gate
Status: done

## Scope

- [x] A parent edit re-renders only the spreads using it (paint cache keyed on the parent, no full-book repaint)
- **Perf:** Gate: edit a parent used by 40 spreads — zero LoAF (frame-budget scenario on the `?fixture=painter` editor, 40 spreads).
- **Test:** unit for the cache invalidation; perf scenario per RULES
- **Depends:** parent-spreads-edit

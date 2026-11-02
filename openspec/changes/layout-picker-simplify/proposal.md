## Proposal

Roadmap: `docs/roadmap/P2/layout-picker-simplify.md`. Owner product decision 2026-11-02, a deliberate difference from the kit.

### Scope out

- Template geometry, auto-fill and stored book data: unchanged, no migration.

### Delta / Risk

- Two portraits is hidden only on two-page spreads, where it equals One per page up to margins; its id stays valid everywhere (see design).
- e2e locks: empty My templates; list order, filters, tooltips, header; hover / click apply. No page-level H/V scroll; the list scrolls only inside the inspector.

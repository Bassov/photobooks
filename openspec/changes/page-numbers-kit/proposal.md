## Proposal

Roadmap: `docs/roadmap/P2/page-numbers-kit.md`. UI ref: Designer `page-numbers` (2026-11-04).

### Scope out

- `src/` (prod `page-numbers-core`, `page-numbers`); per-spread folio hide (`parent-overrides`).
- Spread-list thumbnails and canvas page labels unchanged.

### Delta / Risk

- Folio safe = 5 mm (prod default), not Print's static 8: only safe ≤ 5.33 mm gives top 573.95 px.
- kit qa: empty = Show off (no folios, no seg); happy = Outer/Centre/Inner x; interact = Skip first / roman / Book settings link.

## Proposal

Roadmap: `docs/roadmap/P2/parent-guides-kit.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo`; Designer spec `parent-guides/spec.md` PG5.

### Scope out

- Prod `src/` parent guides (item `parent-guides`), `chrome.tsx` ThumbGrid, presentation, `features/site-*`.
- Kit snapping (already PG3: `snapGuides && guides`).

### Delta / Risk

- Empty observable: a parent-less spread shows no inherited guide.
- Own-guide overhang also grows 12 → 24 px.

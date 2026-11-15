## Proposal

Roadmap: `docs/roadmap/P4/booklet-imposition-core.md` (scope / Done when SoT; whole-feature Musts in `docs/roadmap/P4/booklet-imposition.md`).

### Scope out

- Print dialog options, sheet-count summary, duplex instructions (`booklet-imposition`).
- e2e / perf scenario.

### Delta / Risk

- Padding keeps the last page as the back cover: blanks go just before it.
- Security: the worker reads only the transferred page PDF; no new surface.

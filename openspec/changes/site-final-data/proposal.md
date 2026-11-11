## Proposal

Roadmap: `docs/roadmap/P4/site-final-data.md` (SoT); Designer `personal-site` D37/D38/D40/D41, P2; parity M104.

### Scope out

- Home / room / painter UI and GL chunks.
- D43 font swap (not on main).
- Stage sizing / `catalogColumns` removal (still called).

### Delta / Risk

- Exports grow by `book.json`, `viewer/fonts/*`, 2 preloads; current UI unchanged.
- Security: `book.json` = the page's embedded input (asset ids only).

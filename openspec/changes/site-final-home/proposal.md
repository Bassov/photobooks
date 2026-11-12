## Proposal

Roadmap: `docs/roadmap/P4/site-final-home.md` (scope / Done when / Browser / Perf SoT); UI ref: Designer `personal-site/spec.md`, kit `#/full/personal-site`.

### Scope out

- The reading room and `book.json` navigation (site-final-room); the book page keeps `site.css` / `siteViewer.css`.
- Editor Preview (P6), dark theme, an "All books" list.

### Delta / Risk

- e2e locks: empty site (no case), happy (checkpoints, links open book pages), interact (hover lift, perf); document scroll only, no horizontal scroll.
- Security: no new surface (static fonts; three stays vendored and lazy).

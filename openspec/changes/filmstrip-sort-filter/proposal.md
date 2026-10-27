## Proposal

Roadmap: `docs/roadmap/M3/filmstrip-sort-filter.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/filmstrip-sort-filter`.

### Scope out

- Undo / toast-Undo (no document history yet); persisting sort/filter across reloads.
- EXIF capture time for non-JPEG (falls back to file mtime); removal surviving a re-import.

### Delta / Risk

- Dock head gains Sort menu + "Unplaced only" toggle; thumbs get × and Delete removal (AlertDialog only when placed). Observables: empty-filter copy, shrinking list, scroll only inside `filmstrip-scroll` (no page scroll).
- Security: none (no new FS/worker/URL surface; file on disk never touched).

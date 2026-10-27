## Proposal

Roadmap: `docs/roadmap/M3/assets-panel.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/assets-panel`.

### Scope out

- Effective-DPI column (`dpi-badge`, M6).
- Detecting "modified" on disk automatically; statuses come from the existing relink store (rescan).
- Multi-select / bulk Update.

### Delta / Risk

- New left-panel "Assets" tab beside Pages. Observables: empty ("No photos yet"), happy (rows with thumb, name, status, uses, spreads), click row → pasteboard scrolls to its frame's spread; sort reorders rows; scroll only inside `assets-list`, no page-level scroll.
- Security: Update reuses `acceptModifiedAsset`; no new file access, blob URL or worker surface.

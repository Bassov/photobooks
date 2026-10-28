## Proposal

Roadmap: `docs/roadmap/M4/layout-grids-settings.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/layout-grids-settings`.

### Scope out

- Page-scoped schema bump / `resolveLayoutGrid` / template mirroring (`layout-grids-schema`); `inside`/`outside` are a stub over v3 `left`/`right`.
- Guides, rulers, snapping, Frame tool, parent grid, Templates tab; Ctrl+' shortcut; field scrubbing.

### Delta / Risk

- Inspector gets Spread | Book tabs, each with a "Layout grid" section. Observables: Book tab edit Columns → summary `cols×rows` updates; Spread tab override → `SPREAD` label + Reset enabled (empty selection: no spread section); eye toggle paints an aria-hidden grid overlay on the spread (no page-level scroll change).
- Spread `layoutGrid` becomes a partial override (loosening, no version bump); grid edits re-align templated spreads only. Security: N/A (no file, URL, worker surface).

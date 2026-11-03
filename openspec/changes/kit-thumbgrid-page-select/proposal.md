## Proposal

Roadmap: `docs/roadmap/P2/kit-thumbgrid-page-select.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Prod `src/` (reference only); mounting `TemplateBar` anywhere; new tokens or visuals.

### Delta / Risk

- `TemplateBar` is unmounted in the kit, so the page-1 tile check runs on the mounted layout picker (same rule); observable: tile ring = `shadow-tile-select`.
- No page-level H/V scroll; scrolling only inside the pasteboard scrollport; remount centres the current spread.

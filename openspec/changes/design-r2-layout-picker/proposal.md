## Proposal

Roadmap: `docs/roadmap/P1/design-r2-layout-picker.md` (SoT). UI ref: `uikit#/demo` 14 / 23.

### Scope in (Owner, 2026-10-31)

- Saved templates: `+` / "Save as template", per-browser store, "My templates N" with real counts, tile menu; `?templates=kit` fixture in test builds only.
- Spread sections in kit order: Layout, Master & spacing (new `Spread.masterId`), Background, Grid.

### Scope out

- `bestTemplateId` candidates unchanged.
- The Contact sheet row under the tiles stays (spec'd in layout-geometry; not in the kit).

### Delta / Risk

- Catalog +6 layouts; `2-up` / `4-grid` stay valid ids but leave the picker; e2e that applied them move to kit layouts.
- Plus M25 clean Preview, M2 header row. e2e: empty My templates, kit order, Full bleed clip, hover, Preview.

# parent-spreads

Tag: feature
Milestone: M4.5
Title: parent spreads

## Scope

- [ ] Edit parent spreads (shared items), apply a parent to spreads, "None"; parent items render beneath spread items and are not selectable on the spread
- **Perf:** a parent edit re-renders only spreads using it. Gate: edit a parent used by 40 spreads — zero LoAF.
- **Browser check:** add a logo to a parent, apply it to every spread, move the logo once — all spreads update.
- **UI ref:** `uikit#/feature/parent-spreads`
- **UI kit:** `uikit/src/features/m45.tsx:236-239` (`parent-spreads` demo + notes), `UI ref: uikit#/feature/parent-spreads` — edit/apply parent spreads

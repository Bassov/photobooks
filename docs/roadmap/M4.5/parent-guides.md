# parent-guides

Tag: feature
Milestone: M4.5
Title: guides on parent spreads

## Scope

- [ ] Guides created, moved or typed in while editing a parent belong to the parent; they appear on every spread using it (styled as inherited, not draggable there) and feed `snapping-engine`
- [ ] Spread guides are added on top of parent guides; show / hide guides and snap on / off cover both
- **Perf:** a parent guide drag is a `transform` in rAF on the parent view, committed at gesture end; only spreads using that parent re-render. Gate: drag a guide on a parent used by 40 spreads — zero LoAF.
- **Browser check:** add two guides on a parent — they appear on every spread using it and frames snap to them; add a spread-only guide — it shows on that spread alone.
- **UI ref:** `uikit#/feature/parent-guides`
- **UI kit:** `uikit/src/features/m45.tsx:244-247` (`parent-guides` demo + notes), `UI ref: uikit#/feature/parent-guides` — inherited parent guides

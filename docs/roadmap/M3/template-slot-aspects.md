# template-slot-aspects

Tag: feature
Milestone: M3
Title: orientation-aware templates
Status: done

## Scope

- [ ] Slot aspect class (portrait / landscape / square) in template metadata; portrait-friendly templates (2 portraits, 1 landscape + 2 portraits) and a contact-sheet generator (N×M) in the template bar
- [ ] Pure "best template for these photos" by count and orientation (used by `multi-drop-fill`)
- **Perf:** a template switch still re-renders only the affected spread.
- **Browser check:** apply the 2-portrait and a 3×4 contact-sheet template; frames fit the grid margins; switching back keeps photos in order.
- **UI ref:** `kit v0.9.3 #/feature/template-slot-aspects (removed in kit v0.10.0, no replacement)`
- **UI kit:** `uikit/src/features/pages.tsx` (`template-slot-aspects` demo + notes), `UI ref: kit v0.9.3 #/feature/template-slot-aspects (removed in kit v0.10.0, no replacement)` — portrait templates + best-template highlight

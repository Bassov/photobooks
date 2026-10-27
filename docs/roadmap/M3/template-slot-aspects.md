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
- **UI ref:** `uikit#/feature/template-slot-aspects`
- **UI kit:** `uikit/src/features/m3.tsx:266-274` (`template-slot-aspects` demo + notes), `UI ref: uikit#/feature/template-slot-aspects` — portrait templates + best-template highlight

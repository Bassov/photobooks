# parent-overrides

Tag: feature
Milestone: M4.5
Title: change one spread without touching the parent

## Scope

- [ ] On a spread: override a parent item or guide (Ctrl/Cmd+Shift+click on the inherited item, as in InDesign, or the context-menu "Override parent item" creates a local copy that stops following the parent on that spread), hide a parent item or guide on this spread, "Reset to parent" per item and for the whole spread
- [ ] Overridden and hidden parent items marked in the inspector; the spread's own frames and guides add on top as usual
- **Perf:** an override or reset re-renders only its spread; parent edits skip overridden copies. Gate: edit a parent used by 40 spreads where 10 override its logo — zero LoAF.
- **Browser check:** override the parent logo on one spread and move it, hide a parent guide on another, then move the logo on the parent — every other spread follows, the overridden one keeps its position, the hidden guide stays hidden; Reset to parent restores both.
- **UI ref:** `uikit#/feature/parent-overrides`
- **UI kit:** `uikit/src/features/m45.tsx:248-251` (`parent-overrides` demo + notes), `UI ref: uikit#/feature/parent-overrides` — override/hide parent items

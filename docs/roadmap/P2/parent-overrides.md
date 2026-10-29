# parent-overrides

Tag: feature
Milestone: P2
Title: change one spread without touching the parent

## Scope

- [ ] On a spread: override a parent item or guide (Ctrl/Cmd+Shift+click on the inherited item, as in InDesign, or the context-menu "Override parent item" creates a local copy that stops following the parent on that spread), hide a parent item or guide on this spread, "Reset to parent" per item and for the whole spread
- [ ] Overridden and hidden parent items marked in the inspector; the spread's own frames and guides add on top as usual
- **Perf:** an override or reset re-renders only its spread; parent edits skip overridden copies. Gate: edit a parent used by 40 spreads where 10 override its logo — zero LoAF.
- **Browser check:** override the parent logo on one spread and move it, hide a parent guide on another, then move the logo on the parent — every other spread follows, the overridden one keeps its position, the hidden guide stays hidden; Reset to parent restores both.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer); `roadmap next` must skip it until then.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`parent-overrides`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** override one spread
- **Hard nos:** no UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** parent-spreads
- **UI kit:** none (no matching component); kit-first

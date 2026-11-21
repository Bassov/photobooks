# design-r36-menu-prod

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item design-r36-menu-prod

## Scope

Designer parity, frame-context-menu Musts M138–M140 (Round 36). Prod-only; the kit is the reference.

- [ ] M138: frame menu row icons muted rgb(83,81,82), the Delete row icon rgb(57,55,56) as in the kit; fix the `.pb-icon` cascade (`src/ui/Icon.css`), not a menu-only override; other `.pb-icon` users checked.
- [ ] M139: frame-menu Duplicate row shows a new `copyPlus` glyph (lucide 1.70 CopyPlus), not the Copy glyph; the spread list keeps `duplicate`.
- [ ] M140: `bringToFront` glyph = lucide 1.70 BringToFront (frame menu and ARRANGE).
- **Browser check:** right-click a frame: grey row icons, dark Delete icon, Duplicate ≠ Copy glyph, Bring to front = lucide drawing.

## Done when

- Frame menu row icon colour rgb(83,81,82), Delete icon rgb(57,55,56) (paint check / computed style test); other `.pb-icon` users unchanged.
- Duplicate row glyph ≠ Copy row glyph, = lucide CopyPlus; spread list Duplicate unchanged (unit test on frameMenuModel / glyph ids).
- Bring to front glyph path = lucide 1.70 BringToFront.

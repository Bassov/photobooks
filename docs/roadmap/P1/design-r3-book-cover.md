# design-r3-book-cover

Tag: feature
Milestone: P1
Title: Bug: design-r3-book-cover: back-cover text, spine width, Pages row
Status: in progress

## Scope

- [ ] M5 (step 13): a new book's back text is its title, in the Back field and bottom-left on the canvas back panel.
- [ ] Spine width (step 13): read-only "N mm" text (rendered `#/demo`), computed from the page count (formula in `docs/design.md`) and used by the inspector, canvas spine and cover card.
- [ ] Pages (step 24): editable number box without arrows (rendered `#/demo`), "20–120" hint, spreads note; typed values clamp to 20–120, round to step 2, add/remove spreads (undoable) and persist.
- [ ] Book settings subtitle (step 24, rendered `#/demo`): "<back text> · applies to the whole book".
- **Browser check:** compare steps 13 and 24 against kit `#/demo` at 1440×900.

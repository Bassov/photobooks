# layout-picker-simplify

Tag: feature
Milestone: P2
Title: Simpler Layout picker in the spread inspector (Owner product decision 2026-11-02)
Status: done

## Scope

- [ ] Built-in layout tiles have no visible caption (2-column grid); the name is the tile `title` and `aria-label`; the section header reads `LAYOUT · <name>` of the selected layout. My templates keep visible captions
- [ ] No «Search layouts» field; no «Suggested for N photos» / «All layouts» split: one list sorted by photo count ascending (current order inside a count). Photos Any/1/2/3/4+ and All/My templates filters stay
- [ ] One per page vs Two portraits (and every other same-count pair) compared by real frame rects; a pair that differs only by margins shows one card, the dropped id stays valid on every layout-id caller (books saved with it open and render as before, no data rewrite)
- **Owner words (2026-11-02 14:11):** deliberate difference from the kit; sketch `photobooks-orch/shared/owner/mockups/after-2col.png`
- **Browser check:** open spread 2–3, the list starts with 1-photo layouts, no captions, hover shows the name, header shows the selected name; Photos 2 and My templates filters work
- **Test:** new e2e spec (order, filters, no search, captions/tooltips, header, saved-id fixture with unchanged frame rects); unit tests for catalog order / dedupe / alias

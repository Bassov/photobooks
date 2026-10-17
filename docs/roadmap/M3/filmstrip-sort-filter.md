# filmstrip-sort-filter

Tag: feature
Milestone: M3
Title: working with the gallery

## Scope

- [ ] Sort (capture time from the asset record, name, added order); filter "unplaced only"
- [ ] Remove from gallery with a warning (AlertDialog) when the photo is placed
- **Perf:** sort / filter via `startTransition`. Gate: 1000+ photo gallery scroll and filter toggle — zero LoAF.
- **Browser check:** a 1000+ photo gallery scrolls smoothly; "unplaced only" shrinks as you lay out the book.
- **UI ref:** `uikit#/feature/filmstrip-sort-filter`

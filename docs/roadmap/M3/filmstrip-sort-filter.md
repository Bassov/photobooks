# filmstrip-sort-filter

Tag: feature
Milestone: M3
Title: working with the gallery
Status: done

## Scope

- [ ] Sort (capture time from the asset record, name, added order); filter "unplaced only"
- [ ] Remove from gallery with a warning (AlertDialog) when the photo is placed
- **Perf:** sort / filter via `startTransition`. Gate: 1000+ photo gallery scroll and filter toggle — zero LoAF.
- **Browser check:** a 1000+ photo gallery scrolls smoothly; "unplaced only" shrinks as you lay out the book.
- **UI ref:** `kit v0.9.3 #/feature/filmstrip-sort-filter (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/filmstrip-sort-filter (removed in kit v0.10.0)`, removed) — sort/filter/remove + placed warning dialog, `uikit/src/components/ui/select.tsx`, `uikit/src/components/app/ui.tsx` (AlertDialog)

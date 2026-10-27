# ui-chrome-musts-recheck

Tag: feature
Milestone: M3
Title: Chrome Musts: book covers, settings nav tone-only, quiet editor header
Status: done

## Scope

- [ ] Library covers book-shaped vertical (spine + page edge + Lora italic title); Settings nav pills tone-only (no border); Editor header Saved gray (no green), quiet Rename/New book/Save/Change folder, quiet Publish
- **Browser check:** Library covers are vertical books; Settings nav pills show no outline, selected = #CACACA tone; Editor header Saved dot gray, action row quiet, no black primary besides Create.
- **UI kit:** `uikit/src/features/library.tsx` `BookObject` / `BookTile`, `uikit/src/features/screen-demos.tsx` `SettingsScreen` (kit v0.9.3), `UI ref: uikit#/demo` — look parity only

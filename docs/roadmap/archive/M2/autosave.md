# autosave

Tag: feature
Milestone: M2
Title: never lose work

## Scope

- [x] Debounced autosave, save indicator
- **Perf:** autosave never runs during an active gesture; serialization at background priority (worker if over budget). Gate: continuous drag while autosave fires — zero LoAF.
- **Browser check:** edit, reload without saving — changes are kept; editing never hitches on save.
- **UI ref:** `uikit#/feature/autosave`

# ui-library-grid-v93

Tag: feature
Milestone: M2.6
Title: Port library grid from kit v0.9.3

## Scope

- [ ] Port library-with-books grid from kit (book objects, meta line, search/sort, card menu)
- [ ] Keep open / rename / duplicate / remove wired to existing library storage APIs
- [ ] Settings gear and Change library folder entry points match kit chrome
- **UI kit:** `uikit/src/features/library.tsx` (`HomeScreen`), `UI ref: uikit#/screen/home`, `UI ref: uikit#/demo` (library stage)
- **Browser check:** A library with ≥1 book shows kit book objects; Open enters editor; Rename/Duplicate/Remove behave; Search/Sort filter as in kit
- **Perf:** Library grid scroll stays 60 fps on a ~50-book fixture; hover shadow only (no transform lift); no document scroll
- **Size:** ~800–1200 changed lines; prefer ≤1500
- **Source:** Owner package G

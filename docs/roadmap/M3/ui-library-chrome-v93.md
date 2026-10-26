# ui-library-chrome-v93

Tag: feature
Milestone: M3
Title: Kit v0.9.3 library chrome + book covers

## Scope

- [x] Fix library-with-books chrome so at ≥1280×800 **Create book** (black primary), **Search books**, **Sort**, and settings gear are all visible and usable (layout/CSS; APIs already exist)
- [x] Book covers are book-shaped objects (spine + page edge + Lora italic title), not square plates; caption meta is `N pages · edited …` when edited time is available
- [x] Inter Variable + Lora Variable application matches kit (heading weight 500, cover italic via synthesis parity; no system-ui for Latin UI when fonts.css loads)
- **UI kit:** `uikit/src/features/library.tsx` (`BookTile` / `BookObject` / `LibSearch` / `LibSort` / `LibraryBar`), `UI ref: uikit#/demo` library-with-books
- **Browser check:** Library with ≥1 book at 1280×800 shows Create (black), Search, Sort, gear; covers book-shaped with italic title; meta includes edited when data available; tone-only chrome (no blue); hard nos hold
- **Perf:** Library grid scroll stays in `library-scroll` only; hover shadow only (no transform lift); no page-level H/V scroll
- **Size:** ~1000–1500 changed lines preferred; port-as-is OK to exceed
- **Out of scope:** Settings chrome (L), Create dialog chrome (M), editor look (N), new editor capabilities, site/print
- **Source:** Owner Package K (chrome-align after A–J)

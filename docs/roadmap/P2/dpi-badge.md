# dpi-badge

Tag: feature
Milestone: P2
Title: resolution while you lay out

## Scope

- [ ] Badge on frames below the profile's warn / min DPI (book-editor defaults when no profile is chosen) on the editor overlay layer (editor-only, never in output)
- [ ] Lowest effective DPI column and sort in the assets panel; clicking a low-DPI row jumps to its frame
- **Perf:** DPI computed inside the memoized resolve per spread; one badge element per low frame; recomputed only for changed spreads. Gate: crop-zoom pan across the threshold — zero LoAF.
- **Browser check:** zoom a low-DPI photo inside its frame — the badge appears at the profile threshold and clears when zoomed out; a stricter profile flags more frames; badges never appear in presentation mode; sort the assets panel by DPI.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer); `roadmap next` must skip it until then.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`dpi-badge`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first; Low-res chip in sandbox only)
- **Musts:** low-resolution warning on frames
- **Hard nos:** no warning UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-canvas
- **UI kit:** none (no matching component); kit-first

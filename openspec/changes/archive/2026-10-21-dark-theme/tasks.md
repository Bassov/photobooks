## Implementation

- [x] 1. Product theme module: localStorage + prefers default; setTheme one root attribute write; mount boot uses it
- [x] 2. Add moon/sun glyphs; IconButton theme toggle in EditorTopBar (`app-theme-toggle`); `useProductTheme` only in toggle
- [x] 3. Unit tests for theme persist/toggle; TopBar control
- [x] 4. E2e: toggle chrome/paper/reload; axe empty+happy in both themes; mid-pasteboard toggle zero LoAF
- [x] 5. Tick design.md dark-theme migration + roadmap scope; ui-review

## Manual test scenarios

1. OK Open fixture book; toggle moon/sun — chrome/canvas flip, page paper and photos stay light; contrast readable.
2. OK Reload — chosen theme restored from browser storage.
3. OK With OS prefers opposite of stored choice, stored wins; clear storage → default follows prefers-color-scheme.
4. OK Mid-pasteboard scroll + toggle — UI stays responsive (no long freeze); spreads do not flash/recolor paper.

## Implementation

- [ ] 1. M17: drop the Add spread button + token; migrate unit / e2e callers to Add after / Ctrl+Enter
- [ ] 2. M18: Cover / front Endpaper / back Endpaper inside the `spreads-list` scroller; inner Pages listbox; head offset in window, reveal and drag math
- [ ] 3. M19: `thumbCardStyle` + `ThumbCard` for Cover and Endpaper rows
- [ ] 4. M23: zoom-independent 44 px stack gap (stride, slot padding, camera placement, zoom-commit anchor); labels 6 px under the spread
- [ ] 5. M24: single-page labels centred (page 1, single last page)
- [ ] 6. `e2e/design-r2-spread-list.spec.ts`

## Manual test scenarios

1. 1440×900, open a book with endpapers on: no Add spread button; "…" → Add after adds a spread.
2. Scroll the spread list: Cover and Endpaper rows scroll away; back Endpaper sits after the last page.
3. Cover row card matches the kit shape (wide cover, label row).
4. Canvas: 44 px between spreads at Fit and after zoom in/out; page 1 and the last single page numbers centred.

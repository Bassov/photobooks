## Implementation

- [x] 1. KS9: remove the «Pastedown · glued to … board» caption from `EndpaperSpread` (`uikit/src/sandbox/v7.tsx`). Evidence: kit qa "kit-sync KS9".
- [x] 2. KS10: cover inspector Title font / Cover / Finish as `CoverSel` selects (h 36, r 8, bg #D7D7D7, chevron 16, right edge 1424); Cover editable. Evidence: kit qa "kit-sync KS10" (row tops, selects, editable).
- [x] 3. KS10: Paper white / Hardcover pill + note right-aligned as one group. Evidence: kit qa "read-only pills flush right" (1272.72 / 1295.45).
- [x] 4. KS11: demo library card title ink #F5F5F5 (`uikit/src/demo-parts/library.tsx`). Evidence: kit qa "kit-sync KS11".
- [x] 5. Pin the DOM numbers in `uikit/scripts/qa.mjs` (row tops, select box, pill x, no caption, card colour). Evidence: `uikit:qa:quick` 243 passed, 0 failed.

## Manual test scenarios

1. `#/demo` → editor → select Cover: Title font / Cover / Finish are selects flush right; change Cover to Linen.
2. Book settings: Binding "Hardcover · read-only" sits at the right edge.
3. Endpapers on → select an endpaper: no «Pastedown» caption on the canvas.
4. Library: card titles over the photo are light (#F5F5F5).

`pnpm agent manual-qa` drives the prod app; this change is kit-only, so the scenarios ran as the kit qa `#/demo` walk (headless Chrome, 1440×900):

- OK 1: selects Title font x 1318 w 106 / Cover x 1309 w 115 / Finish x 1289 w 135, h 36, r 8, rgb(215, 215, 215), right 1424; Cover → Linen kept; row tops = Spec (±1).
- OK 2: Hardcover text x 1295.45 (was 1237.2 text / Spec "kit" 1245.20 pill-padded).
- OK 3: endpaper canvas has no «Pastedown» text.
- OK 4: library card title rgb(245, 245, 245); readable over the cover photo (demo baseline 56-library-one-book).

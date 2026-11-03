## Implementation

- [x] 1. KS6: remove the Hide inspector button from the inspector headers (`context-inspector.tsx`, `inspector.tsx`). — qa "kit-sync KS6" (spread 0, photo 0, toggle 1)
- [x] 2. KS7: picker helpers in `templates.ts` (Two portraits merge on spreads, photo-count sort, alias). — qa "kit-sync KS7: one list by photo count…"
- [x] 3. KS7: `LayoutSection` — no search / Suggested / All layouts, uncaptioned builtins, header note via kit `Section` `note`, hint under the tiles, Contact sheet row. — qa "kit-sync KS7" (h 69.5, cols 2 / 3, note, hint, Contact sheet row + apply, empty state)
- [x] 4. KS12: prod Flip H / Flip V glyphs in `inspector.tsx`. — qa "kit-sync KS12"
- [x] 5. KS15: Page size chevron-down 16 px in `index.css`. — qa "kit-sync KS15"
- [x] 6. Kit qa assertions for KS6 / KS7 / KS12 / KS15; update the search-field assertion to 0. — full kit qa 256 passed, 0 failed

## Manual test scenarios

1. `#/demo` editor: open spread p1 → Layout picker 2 columns, no captions, hint, Contact sheet row; Contact sheet click applies a 3×2 grid.
2. My templates tab + Photos 4+ → empty state "No layouts match.".
3. Page 1 → 3 columns; inspector head has no Hide button; Book settings Page size shows a chevron.

Evidence (headless Chrome on the built kit `#/demo`, 1440×900; `pnpm agent manual-qa` drives prod, not the kit):

- OK 1: p1 tiles h 95.25 (A5) / 69.5 (Square 20×20), 2 columns, builtin captions 0, hint present, Columns 3 × Rows 2 (44×32) + Contact sheet; click → "· Contact sheet 3×2", 12 frames.
- OK 2: "No layouts match.".
- OK 3: page 1 → 3 columns; Hide inspector in the head 0 (top-bar toggle 1); Page size background 16px 16px chevron at calc(100% - 8px) 50%.

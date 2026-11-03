## Implementation

- [ ] 1. KS6: remove the Hide inspector button from the inspector headers (`context-inspector.tsx`, `inspector.tsx`).
- [ ] 2. KS7: picker helpers in `templates.ts` (Two portraits merge on spreads, photo-count sort, alias).
- [ ] 3. KS7: `LayoutSection` — no search / Suggested / All layouts, uncaptioned builtins, header note via kit `Section` `note`, hint under tiles, Contact sheet row.
- [ ] 4. KS12: prod Flip H / Flip V glyphs in `inspector.tsx`.
- [ ] 5. KS15: Page size chevron-down 16 px in `index.css`.
- [ ] 6. Kit qa assertions for KS6 / KS7 / KS12 / KS15; update the search-field assertion to 0.

## Manual test scenarios

1. `#/demo` editor: open spread p3 → Layout picker 2 columns, no captions, hint, Contact sheet row; Contact sheet click applies a 3×2 grid.
2. My templates tab + Photos 4+ → empty state "No layouts match.".
3. Page 1 → 3 columns; inspector head has no Hide button; Book settings Page size shows a chevron.

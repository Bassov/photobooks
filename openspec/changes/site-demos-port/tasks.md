## Implementation

- [x] 1. `#/archive[/<slug>]` route, KitBar link (onPress), dispatch + title (`router.ts`, `Shell.tsx`, `main.tsx`).
- [x] 2. Archive index with the "not a design source" note, 12 rows, Desktop / Phone links; demo 9 → `#/full/personal-site` (`site-archive/index.tsx`).
- [x] 3. Port demos 1–8, fresh A–C into `site-archive/` on main's `site/*` and `site-book/*` helpers; `v2.tsx`, `pager.tsx`, `sys.tsx`, `archive.css`; fonts (new files only).
- [x] 4. `e2e/kit-site-archive.spec.ts`: nav → index, rows + order, demos absent from `__kit.pages`, each demo desktop + phone paints at centre, 0 console errors (12 passed locally).

## Manual test scenarios

1. Kit home → "Site demos (archive)" → index shows the archive note and 12 rows.
2. Open demo 6 (dark wall): books on the dark wall, Books switch top centre, a click opens the reading room.
3. Phone link of fresh B: 390 × 844 frame shows the row.

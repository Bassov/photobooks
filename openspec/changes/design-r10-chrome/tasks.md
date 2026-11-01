## Implementation

- [x] 1. `e2e/design-r10-chrome.spec.ts` against kit values (fails on main): every M58 / M62 / M63 item plus the "no Arial button" audit over the walked states.
- [x] 2. M58 root: base-layer `button` font / colour inherit in `styles/app.css`.
- [x] 3. M58 per element: Pages/Masters kit `SegC` geometry; "Add folder…" ink / 500 / 10 px; Settings nav via the root rule.
- [x] 4. M62: layout tab colours; captions ink while the pointer is over the Layout section.
- [x] 5. M63: Create book dialog gap, title, label line boxes, margins, Cancel ink; `ListSelect` 30.84 px rows and popover border.

## Manual test scenarios

1. 1440 × 900 library → New book → "Lake trip": title label top 343.35, Orientation 478.15, hint 544.95, Cancel ink.
2. Open the size menu: rows 30.84 px apart (A4 top 536.69). Pick Custom size 19 × 23: select value top 426.33.
3. Create → editor: Pages/Masters 92 × 26 in Inter 13 / 500; "Add folder…" Inter 12 / 500 ink.
4. Pointer over the Layout section: captions ink; pointer on the top bar: captions muted.
5. Library → Settings: nav "Library" Inter ink; back to the library.

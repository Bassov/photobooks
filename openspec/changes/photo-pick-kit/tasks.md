## Implementation

- [x] 1. `store.tsx`: `placePhoto`, `startPick` (status, cur, selection), `endPick`, `pickPhoto`; `canvas.tsx` `handleDrop` uses `placePhoto`. (e2e `kit-photo-pick` one-undo-step tests)
- [x] 2. `chrome.tsx`: filmstrip pick look (`data-picking` ring, `cursor: copy`, hover / focus tone), focus on start, click / Enter picks. (`kit-photo-pick` ring pixel, cursor, Enter tests)
- [x] 3. `canvas.tsx`: "Replacing" / "Placing" tag on the target frame. (`kit-photo-pick` tag text / radius 6 / top −24)
- [x] 4. `viewport.tsx`: `usePickGuard` (Esc first, outside press, spread / mode / preview / frame removed or locked; status kept); `frame-menu.tsx` rows need ≥ 1 photo. (`kit-photo-pick` Esc / outside tests; `kit-frame-menu` disabled rows)
- [x] 5. `e2e/kit-photo-pick.spec.ts`: ring, cursor, status, tag, click / Enter pick + one undo step, Esc / outside cancel, Place on empty, locked rows disabled.
- [x] 6. `demo-capture.mjs`: `editor-frame-menu`, `editor-photo-pick`, `editor-photo-picked`; local re-baseline (93 steps, no page errors).

## Manual test scenarios

1. `#/demo` book, right-click a filled frame → Replace photo… → dock ring, "Replacing" tag, status; click a thumb → photo replaced; Ctrl+Z restores.
2. Same start, Esc → no change, ring and tag gone.

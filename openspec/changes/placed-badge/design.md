## Decisions

1. `placedJump.ts`: pure `placeLabel` / `nextPlaceIndex` / `placedStatus` plus `jumpToPlacement(assetId)` over existing stores
   (`setLeftPanelTab('pages')`, `exitCropMode`, `commitTextEdit`, `requestSpreadReveal` + `setFrameSource`, cover / endpaper
   row actions). No `dispatchBookOp` → no history step; the camera is not touched.
2. B3 position model: cover −2, front endpaper −1, spread index, back endpaper = spread count; active = selected cover /
   endpaper, else the active spread. Memory `{assetId, place}` counts only while the selection is exactly that place.
3. Reveal: a rAF wait (≤ 30 frames) for the frame element in `pasteboard-scroll`, then `nudgeBoxIntoPort` only when its rect is
   outside the port inset 24 px.
4. Grid precedence: pick mode → badge click (jump, no `applyPick`) → Enter / double-click on a placed row (jump; not on the
   badge, not after a pick click).
5. Look per Designer spec / kit badge values in `Filmstrip.css`; status pill via `isStatusPillVisible`. The css-tokens gate bans
   raw colours outside token files, so rest / hover / pressed are new tokens `--placed-badge*` (`styles/tokens.css`, listed in
   `docs/design.md`); the count uses `--text-3xs`.

## Touch-set & Test Plan

| Path                              |
| --------------------------------- |
| `src/editor/placedJump.ts`        |
| `src/editor/placedJump.test.ts`   |
| `src/editor/FilmstripItem.tsx`    |
| `src/editor/Filmstrip.tsx`        |
| `src/editor/Filmstrip.css`        |
| `src/editor/editorStatus.ts`      |
| `src/editor/editorStatus.test.ts` |
| `styles/tokens.css`               |
| `docs/design.md`                  |
| `src/editor/Filmstrip.test.tsx`   |
| `e2e/placed-badge.spec.ts`        |

- Unit: placedJump (B3, Masters, statuses); Filmstrip (badge / Enter / double-click, labels, pick wins).
- e2e: unplaced (no badge, Enter no-op), happy (cycle + pill), interact (hover paint, Enter focus, drag, Ctrl+Z); skill
  `ui-review`.

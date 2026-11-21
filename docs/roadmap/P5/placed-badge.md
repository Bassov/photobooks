# placed-badge

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item placed-badge
Status: done

Prod filmstrip: the "placed" badge becomes the "Show in the book" button (Designer placed-badge spec B1–B9, "Look",
"Semantics", "Jump", "Prod files", "Tests"; Must PB3). Owner Q-25: click + count + cycle, in three items; core
(`placed-badge-core`, `placementsOfAsset`) and kit (`placed-badge-kit`, the reference look) are merged.

## Scope

- [x] `src/editor/placedJump.ts` (new): places from `placementsOfAsset` in spread-list order; start per B3 (the last jump
      still selected → next, wrapping; else the first place at or after the active spread; else the first); Masters → Pages,
      crop ends, text commits; frame → spread reveal + frame selection (locked too) + nudge into the port only when not in
      view, cover / endpaper → their row action; status `Placed i of n · <label>` (pill) for 2+, `Placed on <label>` for 1,
      cleared after 2500 ms. No history step, no zoom change.
- [x] `src/editor/FilmstripItem.tsx`: badge = `span role=button` (not focusable), `title` / `aria-label` "Show in the book"
      (", placed N times" for 2+), `✓ N` count (`9+`), row `aria-keyshortcuts="Enter"` when placed.
- [x] `src/editor/Filmstrip.tsx`: badge click → jump (no row select); Enter / double-click on a placed row → jump, focus kept;
      photo-pick wins first (B6); a drag from the badge still drags the photo (B7).
- [x] `src/editor/Filmstrip.css`: Look table (check 10, blur 8, hover .8 + scale 1.125, pressed .9, count pill, 24 × 24 hit
      area, reduced motion = colour only, pick mode = no hover look). `src/editor/editorStatus.ts`: pill pattern.
      `editorChromeTokens.ts` unchanged.
- [x] Tests: `placedJump.test.ts`, `Filmstrip.test.tsx`, new `e2e/placed-badge.spec.ts`.
- **Browser check:** editor at 1440 × 900, a photo on pages 2–3 and page 4: badge `✓ 2`; two clicks select the frame on 2–3,
  then on 4 with the pill `Placed 2 of 2 · Page 4`; a third wraps; zoom unchanged.
- **UI kit:** `uikit#/demo` filmstrip (placed-badge-kit).

## Done when

1. e2e at 1440 × 900: badge 16 × 16 at right/bottom 4 (±0.5), check 10 × 10, `rgba(0,0,0,.55)`, blur 8; hover
   `rgba(0,0,0,.8)` + scale 1.125; `✓ 2` width 24 ±1.
2. 1st / 2nd / 3rd click = place 1 / `Placed 2 of 2 · Page 4` / wrap; the filmstrip row is not selected; zoom unchanged;
   cover place selects the cover; Masters → Pages; locked frame selected.
3. Enter on the focused placed row cycles and keeps focus; unplaced row: nothing.
4. Drag from the badge centre onto an empty frame places the photo; Ctrl+Z undoes the drop, not the jump.
5. `placedJump.test.ts`: B3 start (current spread wins, wrap, memory only while the selection matches), Masters → Pages,
   status texts. Existing `filmstrip-placed` tests and `editorHardNos.test.ts` unchanged and green.

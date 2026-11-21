# placed-badge-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item placed-badge-kit
Status: done

Kit `#/demo` filmstrip: the "placed" badge becomes the "Show in the book" button (Designer placed-badge spec B1–B9,
"Look", "Semantics", "Kit"; Must PB1). Owner Q-25: click + count + cycle, in three items (core, kit, prod). The kit is the
design source for the later prod item `placed-badge`.

## Scope

- [ ] `uikit/src/sandbox/store.tsx`: `placesOf(doc, photoId, coverPhoto)` in spread-list order (cover, then spreads × frames
      bottom → top); `nextPlaceIndex` (B3: the last jump still selected → next, wrapping; else the first place at or after the
      active row, else the first); `jumpTo` (crop ends, Pages mode, `setCur` + `setSel([frameId])` or the cover node). No
      history step (B9).
- [ ] `uikit/src/sandbox/chrome.tsx`: badge = React Aria `Button` (`slot={null}`, not in the tab order, no focus on press),
      `data-testid="filmstrip-placed"`, `title` / `aria-label` "Show in the book" (", placed N times" for 2+); Look table
      (16 px disc, check 10, blur 8, `✓ n` pill with Inter 10/600 tabular-nums, `9+`, hover .8 + scale 1.125, pressed .9,
      24 × 24 hit area, reduced motion = colour only, pick mode = no hover look + copy cursor, the press is the pick).
      ThumbGrid `onAction` (Enter / double-click on a placed row) = the badge. Status: `Placed i of n · <label>` pill for 2+,
      `Placed on <label>` screen-reader only for 1, cleared after 2500 ms. `withCover` / `placedSet` keep counting the cover.
- [ ] `uikit/scripts/demo-capture.mjs`: `editor-placed-badge-hover`, `editor-placed-badge-jump`, `editor-placed-badge-twice`
      after `editor-photo-dropped-in-frame`, with a restore that keeps the later shots.
- [ ] New `e2e/kit-placed-badge.spec.ts`; kit specs that found the badge by its old title use the testid.
- **Browser check:** `#/demo` at 1440 × 900, photos added, row 5 on pages 2–3 and 4–5: badge `✓ 2`; from page 1 two clicks
  select pages 2–3's then 4–5's frame with the pill `Placed 2 of 2 · Pages 4–5`, gone after 2.5 s.

## Done when

1. Badge DOM at 1440×900, thumb H 76: 16×16 (1 place) at right 4 / bottom 4, check 10×10; 2 places → width ≈24, text `2`;
   hit area 24×24 (4 px around the disc hits the badge).
2. Click on a placed badge selects the place (active spread + frame selection), filmstrip selection not set by the click;
   2 places: two clicks cycle 1 → 2, pill `Placed 2 of 2 · Pages 4–5` visible, gone after 2500 ms.
3. Enter on a focused placed row = badge click, focus stays on the row; unplaced row Enter does nothing.
4. In photo-pick mode a badge click is the pick (no jump).
5. Hover paint check: badge background rgb(0 0 0/.8) under hover (pixel sample).
6. demo-capture steps added; every other shot unchanged vs the old baseline except file numbering and the cover photo's
   badge, which counts its two places (`✓ 2`) once it also sits in a frame.

- **Hard nos:** no `src/**`, `uikit/src/demo-parts/editor.tsx`, `uikit/src/index.css`, `uikit/scripts/qa.mjs`,
  `uikit/src/kit/pages.json`, `uikit/src/features/pages.tsx`, `uikit/src/components/app/controls.tsx` edits.
- **UI kit:** `uikit#/demo` editor filmstrip (`uikit/src/sandbox/chrome.tsx` `Filmstrip`).

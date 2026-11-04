## Implementation

- [x] 1. `viewGuides` in `src/core/parentSpreads.ts` (mapping, range, cache) + export; PBT in `src/core/parentSpreads.test.ts` (`viewGuides (property)`, 1000 runs).
- [x] 2. `GuidesOverlay` renders `viewGuides` layers (parent dashed, pointer-transparent) via `subscribeBookStore`; `Guides.css` parent rule; `GuidesOverlay.test.tsx` cases (parent layer, new spread id, re-render only on its parent).
- [x] 3. `bookStore.test.ts`: guide-only parent edit repaints only the parent (`notified: ['pA','pA'], invalidated: ['pA']`).
- [x] 4. e2e `parent-spreads-guides.spec.ts`: Pages shows the parent line; browser check (display, None spread, spread-only guide, click-through, style, first page); 40-spread gate extended with the Pages switch (switch LoAF logged; it blocks on main too).

## Manual test scenarios

1. Painter fixture `&parent=a`: add a guide on Master A, switch to Pages — every spread shows it dashed, a press on it over a frame selects the frame; Ctrl+; hides it.

- problem (harness, not product): `pnpm agent manual-qa --change parent-guides` blocked at welcome (start-session click intercepted by the welcome header, 30 s timeout); no scenario ran. Covered instead by e2e `parent-spreads-guides.spec.ts` "Browser check: master guides show dashed and read-only…" (display, None spread, click-through via `elementFromPoint`, Ctrl+;, `assertDocumentFitsViewport`) and the 40-spread gate (0 LoAF on the guide drag).

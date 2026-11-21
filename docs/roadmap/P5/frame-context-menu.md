# frame-context-menu

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-context-menu
Status: done

## Scope

Designer Spec frame-context-menu FM3 (prod full menu = kit FM1 `uikit/src/sandbox/frame-menu.tsx`; Owner Q-24 decided 2026-11-21, Cut in per M8).

- [x] `src/editor/frameMenuModel.ts` (pure): `frameMenuRows(book, target, ctx)` → rows / separators per kind (filled, empty, text, set, locked, override copy, Masters scope) in one fixed order photo · edit · order · lock + delete; a row is enabled exactly when its command would act (M1/M2).
- [x] `src/editor/FrameContextMenu.tsx`: render from the model with `disabledKeys`, dispatch table (cut / copy / paste / duplicate, pick, unplace, setFit, crop, z / lock, delete), M5 focus (pointer open: no focused row; Shift+F10: first enabled row), M6 page menu (Paste / Paste in place on the paper when the clipboard mirror holds frames).
- [x] `src/editor/menuKeys.ts`: M7 key labels; macOS glyphs (⇧⌘⌫, no "+").
- [x] `src/ui/icons/glyphs.ts`: `replace`, `imagePlus`, `shrink`, `expand`, `crop`, `scissors`, `clipboardPaste`.
- **Browser check:** `e2e/frame-context-menu.spec.ts`: 14 rows / 3 separators, height 468.81 ±0.5, width 224, inside the viewport at y 840; rows per kind with `aria-disabled`; pointer open has no `data-focused`, Shift+F10 focuses the first enabled row; menu Copy → page menu Paste +10.6 px; Duplicate / Fit ↔ Fill / Delete one undo step; Replace photo… pick; hover bg #CFCFCF pixel sample.

## Done when

1. Filled photo frame at 1440×900: 14 rows in the Spec order, 3 separators, menu height 468.81 ±0.5 px, width 224; opened at y 840 it stays inside the viewport.
2. Empty / text / set / locked / override copy / Masters frames show exactly the Rows per kind; non-applicable rows are `aria-disabled="true"`, not hidden (locked: Replace / Place / Cut disabled; Remove / Fit / Crop / Copy / Duplicate / Delete enabled).
3. Pointer right-click: no row has `data-focused`; Shift+F10: first enabled row focused.
4. Menu Copy → right-click empty paper → page menu Paste lands +5 mm (10.6 px at Fit ±0.5); Duplicate, Fit ↔ Fill label swap, Delete = one undo step each.
5. Replace photo… → status text + filmstrip `data-picking` → click thumb 3 → frame asset = thumb 3, one undo step; Esc cancels with no op.
6. Hover paint check on a row: bg #CFCFCF (pixel sample); Delete row focus bg = destructive mix.

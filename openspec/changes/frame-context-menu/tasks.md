## Implementation

- [x] 1. Glyphs `replace`, `imagePlus`, `shrink`, `expand`, `crop`, `scissors`, `clipboardPaste` (lucide 1.70 arrays). Evidence: `src/ui/Icon.test.tsx` (96 names).
- [x] 2. `menuKeys.ts` + test (M7, mac glyphs ⇧⌘⌫ with no "+"). Evidence: `src/editor/menuKeys.test.ts`.
- [x] 3. `frameMenuModel.ts` + test: roadmap Done when 2, every kind (filled, empty, text, set, locked, copy, Masters). Evidence: `src/editor/frameMenuModel.test.ts`.
- [x] 4. `FrameContextMenu.tsx`: render from the model, `disabledKeys`, dispatch table, M5 focus, M6 page menu; unit test pins updated. Evidence: `src/editor/FrameContextMenu.test.tsx` "rows and commands (FM3)".
- [x] 5. e2e: `frame-context-menu.spec.ts` (Done when 1–6); pins in `arrange-lock` and `parent-overrides` updated. Evidence: 25 passed locally with `photo-pick.spec.ts`.

## Manual test scenarios

1. Right-click a filled photo frame: 14 rows, no highlighted row; Fit photo to frame swaps the label to Fill frame on reopen.
2. Copy from the menu, right-click empty paper: Paste lands +5 mm and is selected.
3. Replace photo… then click a filmstrip thumb: the frame shows that photo.

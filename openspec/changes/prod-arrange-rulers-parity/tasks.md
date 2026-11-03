## Implementation

- [x] 1. Arrange buttons named `"<label> (<keys>)"` with the kit key strings; context menu hints follow (`frameArrange.ts`, `FrameSections.tsx`; `FrameSections.test.tsx` "names each Arrange button with its kit shortcut", `Inspector.test.tsx` "names the set Arrange buttons with their kit shortcut", `FrameContextMenu.test.tsx`)
- [x] 2. Ruler cursors `s-resize` / `e-resize` (`Rulers.css`; `Rulers.test.tsx` "shows the kit resize cursors")
- [x] 3. `guideStatus` + pill rule (`editorStatus.ts`; `editorStatus.test.ts` two-page / single-page / horizontal / pill cases)
- [x] 4. Guide commit sets the status (`guideGesture.ts`; `guideGesture.test.ts` "states a placed or moved guide with its page on a two-page spread"); e2e `e2e/guides.spec.ts` "pull guides from both rulers" asserts the pill text

## Manual test scenarios

1. Select a photo frame, hover each Arrange button: tooltip "Send to back (Shift+Ctrl+[)" … "Bring to front (Shift+Ctrl+])".
2. Hover the top / left ruler: `s-resize` / `e-resize` cursor.
3. Pull a vertical guide onto the right page of a two-page spread: status pill "Vertical guide at N mm (right page)"; a horizontal one: "Horizontal guide at N mm".

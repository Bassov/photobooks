## Implementation

- [x] 1. Arm Space-pan on capture when pointer is over pasteboard and focus is not a text field; leave Space alone when pointer is off the pasteboard (`usePasteboardCamera`).
- [x] 2. Unit regression: after a Space-consuming filmstrip-like focus target, pointerenter pasteboard + Space+drag pans; Space with radio focus and pointer off pasteboard does not arm (`cameraGesture.test.tsx`).
- [x] 3. Playwright regression: click filmstrip tile → move pointer over pasteboard → Space+drag pans (`e2e/spread-view.spec.ts` PB-04).
- [x] 4. Sync spread-view Space-pan scenario for pointer-over + filmstrip-focus behavior.

## Manual test scenarios

1. Open editor → import a photo → click a filmstrip tile → move pointer over pasteboard → Space+drag: pasteboard pans.
2. Focus a filmstrip tile (keyboard) with pointer not over pasteboard → Space: tile activates / selection toggles; pasteboard does not pan.
3. Focus a text input → Space+drag over pasteboard: does not pan.
4. Click pasteboard → Space+drag: still pans.

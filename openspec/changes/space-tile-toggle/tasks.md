## Implementation

- [x] 1. While Space is stolen for pasteboard pan arming, defer focused-control activation until keyup unless a pasteboard Space-drag starts (`usePasteboardCamera`).
- [x] 2. Unit regression: filmstrip-like focus + pointer over pasteboard → Space alone activates; Space+drag still pans and does not activate (`cameraGesture.test.tsx`).
- [x] 3. Playwright regression PB-04b: focused filmstrip tile + pointer over pasteboard → Space toggles selection; keep PB-04 Space+drag pan (`e2e/spread-view.spec.ts`).
- [x] 4. Sync spread-view Space-pan scenario: activate unless pasteboard Space-drag begins.

## Manual test scenarios

1. Open editor → import a photo → focus a filmstrip tile → move pointer over pasteboard → Space (no drag): tile activates/toggles.
2. Focus a filmstrip tile → pointer over filmstrip → Space: tile activates/toggles.
3. Click a filmstrip tile → move pointer over pasteboard → Space+drag: pasteboard pans; selection does not toggle from that Space.
4. Focus a text input → Space+drag over pasteboard: does not pan.

## Implementation

- [x] 1. Arm Space-pan unless focus is a text field (remove button/anchor Space early-return in `usePasteboardCamera`).
- [x] 2. Unit regression: Space+drag pans with focus on a camera-bar button; Space still ignored in a text input (`cameraGesture.test.tsx`).
- [x] 3. Sync spread-view Space-pan scenario for chrome-focus behavior.

## Manual test scenarios

1. Open editor → click a filmstrip or toolbar control → move pointer over pasteboard → Space+drag: pasteboard pans.
2. Focus a text input (if any) → Space+drag over pasteboard: does not pan / Space types or stays in field.
3. Click pasteboard → Space+drag: still pans (happy path unchanged).

OK Open editor → click a filmstrip or toolbar control → move pointer over pasteboard → Space+drag: pasteboard pans.
OK Focus a text input (if any) → Space+drag over pasteboard: does not pan / Space types or stays in field.
OK Click pasteboard → Space+drag: still pans (happy path unchanged).

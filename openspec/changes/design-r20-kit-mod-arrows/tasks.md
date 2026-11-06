## Implementation

- [x] 1. e2e `e2e/kit-preview-mod-arrows.spec.ts`: modified arrow / Home / End keep Pages 2–3; plain → steps to Pages 4–5 (failed before the fix: Alt+→ gave "Pages 4–5").
- [x] 2. Guard Alt / Ctrl / Meta in the kit site-viewer book-page keydown (`uikit/src/features/site-viewer.tsx`).

## Manual test scenarios

1. Kit `#/demo` → create a book → Preview → → → (Pages 2–3) → Alt+→ / Ctrl+→ / Meta+→ keep Pages 2–3 → plain → shows Pages 4–5.

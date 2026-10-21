## Implementation

- [x] 1. Home a11y: `h1`, selected-library live announcement, ensure focus-visible rings; busy keeps focus on the active control
- [x] 2. Expand `HomeScreen.test.tsx` (empty / list / error / permission / busy / keyboard + announce/focus); reserved-key mutation coverage
- [x] 3. Restore empty-editor asserts in `e2e/open-save.spec.ts` (Start editing → card + pasteboard scrollport)
- [x] 4. Re-grant polish: refuse peek-failed bare picker; keep target-book open after grant
- [x] 5. Readable editor-status messages (no raw codes); distinguish deny vs picker cancel
- [x] 6. Remove runtime `window.__photobooksE2e` test-API switch

## Manual test scenarios

1. Keyboard-only home: Tab through New library / Open / recents; selected library announces; focus ring visible.
2. Narrow ~900px home: columns stack; home scrollport only (no page scroll).
3. Deny folder access on Grant access → readable deny message; focus stays on Grant access.
4. Cancel directory picker on Grant access → distinct cancel message; focus stays on Grant access.
5. Start editing from empty home → empty-editor card visible; pasteboard scrollport OK.

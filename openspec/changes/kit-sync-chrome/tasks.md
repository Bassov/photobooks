## Implementation

- [x] 1. KS1: `#/demo` view toggles = snap, grid; guides / rulers / overlays off by default; TopBar grid centres the tools on the canvas (w 210, cx 676) — qa "kit-sync KS1 (M39)", "kit10 → kit-sync KS1"
- [x] 2. KS8: remove the spread list Add spread + Ctrl+↵ row — qa "kit-sync KS8: 0 Add spread rows"
- [x] 3. KS14: `demo-parts/presentation.tsx` presentation mode; `#/demo` Preview opens it on the cover; Esc closes — qa "kit-sync KS14"
- [x] 4. Kit qa: KS1 / KS8 / KS14 assertions; kit10 + §2 assertions moved to the new values; demo-capture view steps use keys — kit qa 259 passed, 0 failed
- [x] 5. Kit page copy (spread list, Preview) follows the new behaviour — `uikit/src/features/pages.tsx`

## Manual test scenarios

1. `#/demo` editor: top bar shows 4 tools + Snap + Grid over the canvas centre; spread 1 shows no dashed guides; the spread list ends without Add spread.
2. Preview → black presentation on the cover, "Esc" top-right, "Cover" bottom centre; → shows "1 / n"; Esc returns to the editor.

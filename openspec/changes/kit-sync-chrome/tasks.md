## Implementation

- [x] 1. KS1: `#/demo` view toggles = snap, grid; guides / rulers / overlays off by default; TopBar grid centres the tools on the canvas (w 210, cx 676) — qa "kit-sync KS1 (M39)", "kit10 → kit-sync KS1"
- [x] 2. KS8: remove the spread list Add spread + Ctrl+↵ row — qa "kit-sync KS8: 0 Add spread rows"
- [x] 3. KS14: `demo-parts/presentation.tsx` presentation mode; `#/demo` Preview opens it on the cover; Esc closes — qa "kit-sync KS14"
- [x] 4. Kit qa: KS1 / KS8 / KS14 assertions; kit10 + §2 assertions moved to the new values; demo-capture view steps use keys — kit qa 259 passed, 0 failed
- [x] 5. Kit page copy (spread list, Preview) follows the new behaviour — `uikit/src/features/pages.tsx`

## Manual test scenarios

1. `#/demo` editor: top bar shows 4 tools + Snap + Grid over the canvas centre; spread 1 shows no dashed guides; the spread list ends without Add spread.
2. Preview → black presentation on the cover, "Esc" top-right, "Cover" bottom centre; → shows "1 / n"; Esc returns to the editor.

- harness problem: `pnpm agent manual-qa --base-url <kit #/demo>` waits for the prod `editor-shell`, so it cannot drive the kit (exit 1 before any scenario). Evidence below is the headless kit qa (`uikit/scripts/qa.mjs`, 259 passed) and the `#/demo` capture walk (64 steps), both at 1440×900.
- OK 1: toggles `1,1,0,0,0,0` (snap, grid only); tools w 210, cx 676 = canvas 676; guides / rulers / overlays `0,0,0`; 0 Add spread rows (15 rows).
- OK 2: presentation fixed 1440×900, bg rgb(13, 13, 13); Esc chip top 16 right 16 h 32 12 px; caption "Cover" bottom 16, centred; cover fit within 0.01 px; → "1 / 9"; Esc → closed, stage editor.

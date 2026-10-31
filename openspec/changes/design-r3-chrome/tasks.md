## Implementation

- [x] 1. M20: tool group hugs its tools and is kit `mx-auto` centred (`EditorShell.css`); e2e `design-r3-chrome.spec.ts` M20 at 1440 / 1280.
- [x] 2. M11: disabled kit Print / Publish after Settings (`EditorTopBar.tsx`, `.editor-soon`); unit `EditorTopBar.test.tsx`, e2e M11, `design-r2-toolbar-kitset.spec.ts` kit list.
- [x] 3. M26: empty filmstrip row = kit `--thumb` 104 (`filmstripSize.ts`, `FilmstripDock.tsx`, `Filmstrip.css`, `filmstripChromeStyles.ts`); e2e M26 empty dock 160 / Fit 588 / gap ratio and photos dock 132.

## Manual test scenarios

1. 1440 × 900, new 19 × 23 book "Lake trip": tools sit between undo / redo and zoom with equal space; compare with kit `#/demo`.
2. Print and Publish are greyed after the gear; hover and click do nothing.
3. Empty book: dock top at y = 740; Fit spread is 588 tall. Add a folder: dock shrinks to 132 like the kit.
4. 1280 width: no overlap in the top bar.

Results (`pnpm agent manual-qa` could not reach the editor: every scenario timed out because the welcome-screen header intercepts the click on `start-session`. That is a harness / welcome-screen issue, not this change. The scenarios were checked with a Playwright script on the dev server instead):

- OK 1: 1440, Lake trip: group 567–777 (centre 672), redo ends 441, zoom-out starts 903 → equal 126 px free space each side; kit #/demo centre 696 for its longer "Untitled book 14.8 × 21 cm · 20 pages" title (was: tools at 432–640 inside a 616 px stretched toolbar).
- OK 2: Print / Publish after the gear, opacity .5, `disabled`, `pointer-events: none` (e2e M11 + unit).
- OK 3: empty dock 740–900 (160), Fit spread 588 at y 104, next spread at 736 (gap 44); with one photo the dock is 132 (e2e M26).
- OK 4: 1280: group 487–697 between redo (441) and zoom-out (743), one row, no overlap (e2e M20 at 1280).

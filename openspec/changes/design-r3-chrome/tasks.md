## Implementation

- [x] 1. M20: tool group hugs its tools and is kit `mx-auto` centred (`EditorShell.css`); e2e `design-r3-chrome.spec.ts` M20 at 1440 / 1280.
- [x] 2. M11: disabled kit Print / Publish after Settings (`EditorTopBar.tsx`, `.editor-soon`); unit `EditorTopBar.test.tsx`, e2e M11, `design-r2-toolbar-kitset.spec.ts` kit list.
- [x] 3. M26: empty filmstrip row = kit `--thumb` 104 (`filmstripSize.ts`, `FilmstripDock.tsx`, `Filmstrip.css`, `filmstripChromeStyles.ts`); e2e M26 empty dock 160 / Fit 588 / gap ratio and photos dock 132.

## Manual test scenarios

1. 1440 × 900, new 19 × 23 book "Lake trip": tools sit between undo / redo and zoom with equal space; compare with kit `#/demo`.
2. Print and Publish are greyed after the gear; hover and click do nothing.
3. Empty book: dock top at y = 740; Fit spread is 588 tall. Add a folder: dock shrinks to 132 like the kit.
4. 1280 width: no overlap in the top bar.

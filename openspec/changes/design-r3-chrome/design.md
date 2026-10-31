## Decisions

1. **Tool group = kit `mx-auto` flow.** M20 root cause: `.editor-top-bar.pb-toolbar` had `flex: 1 1 auto`, so the toolbar filled the gap and its tools sat at its left edge. `flex: 0 1 auto` lets `mx-auto` centre the hugged group between history and zoom, as kit `TopBar` does. Rendered kit #/demo: centre 696 vs bar 720 at 1440, 549 vs 640 at 1280. Bar-centring would diverge from the kit, which wins per brief rules.
2. **Print / Publish = kit demo right group.** `ChromeButton` pills (`h-8 rounded-full px-3.5`, `FIELD` #D7D7D7, Publish `e7-sec`), grouped with Preview / Settings at `gap-1.5` like `demo-parts/editor.tsx`. Native `disabled` plus `.editor-soon:disabled { opacity: .5; pointer-events: none }` mirrors kit Button `data-[disabled]`.
3. **Empty dock = kit `--thumb`.** New `FILMSTRIP_EMPTY_HEIGHT = 104` (`filmstripSize.ts`, `--film-empty-h` on the dock). The empty row becomes 104 + 12 (padding 4 / 12 / 8, row, text left), so the dock is 40 + 116 + 4 = 160. Thumbs stay 76 (kit `view.thumb`); the photos dock stays 132 as in the kit.

## Touch-set & Test Plan

- Files: `src/editor/EditorTopBar.tsx`, `EditorShell.css`, `FilmstripDock.tsx`, `Filmstrip.css`, `filmstripSize.ts`, `filmstripChromeStyles.ts` (inline padding 0 dropped), `EditorTopBar.test.tsx`; e2e `design-r3-chrome.spec.ts`, `design-r2-toolbar-kitset.spec.ts`, fixture `openLibraryBook.ts`, `perf/perfFixture.ts` (`createBookInLibrary` arg typing); `docs/roadmap/P1/design-r3-chrome.md`.
- Reuse: `ChromeButton`, `FIELD`, `stackGap` / `zoomMenu` fixtures.
- Tests: unit Print / Publish disabled + order; e2e empty (dock 160, Fit 588), happy (photos dock 132), interact (Fit spread, gap ratio), top bar at 1440 / 1280; skill `ui-review`.

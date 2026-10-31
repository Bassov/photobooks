## Decisions

1. **Tool group = kit `mx-auto` flow.** M20 root cause: `.editor-top-bar.pb-toolbar` had `flex: 1 1 auto`, so the toolbar filled the gap and its tools sat at its left edge. `flex: 0 1 auto` lets `mx-auto` centre the hugged group between history and zoom, as kit `TopBar` does. Rendered kit #/demo: centre 696 vs bar 720 at 1440, 549 vs 640 at 1280. Bar-centring would diverge from the kit, which wins per brief rules. The kit right group also holds Print / Publish (dropped: features not shipped), so prod's narrower right group puts the centre at 745.5 (1440) / 665.5 (1280). That is the same rule with fewer controls, not a different placement.
2. **Empty dock = kit `--thumb`.** New `FILMSTRIP_EMPTY_HEIGHT = 104` (`filmstripSize.ts`, `--film-empty-h` on the dock). The empty row becomes 104 + 12 (padding 4 / 12 / 8, row, text left), so the dock is 40 + 116 + 4 = 160. Thumbs stay 76 (kit `view.thumb`); the photos dock stays 132 as in the kit.

## Touch-set & Test Plan

- Files: `EditorShell.css`, `FilmstripDock.tsx`, `Filmstrip.css`, `filmstripSize.ts`, `filmstripChromeStyles.ts` (inline padding 0 dropped); e2e `design-r3-chrome.spec.ts`, fixture `openLibraryBook.ts`, `perf/perfFixture.ts` (`createBookInLibrary` arg typing); `docs/roadmap/P1/design-r3-chrome.md`.
- Reuse: `stackGap` / `zoomMenu` fixtures.
- Tests: e2e empty (dock 160, Fit 588), happy (photos dock 132), interact (Fit spread, gap ratio), top bar at 1440 / 1280; skill `ui-review`.

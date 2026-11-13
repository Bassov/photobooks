# design-r24-site-prod

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r24-site-prod

## Scope

Designer parity personal-site Round 24 (2026-11-13), Musts M106, M107, M110 in prod; the kit (`uikit/src/features/site/sys.tsx`, `#/demo` personal-site) is the reference (spec D23, D41/D42, D45).

- [ ] M106 `src/site/book/turn.tsx` / `room.css`: phone Page turn with WebGL paints the page at rest (the `pt-gl` canvas shows once it has drawn; the CSS page shows until then); `?gl=0` keeps the CSS page.
- [ ] M107 `src/site/SiteRoom.tsx`: a 390 px tap on a home book opens the room at "Cover" (no `#p1`); the desktop cover turn on open is unchanged.
- [ ] M110 `src/site/SiteRoom.tsx`: the desktop room's site name is a link home with the same look (cursor pointer); a click returns home in one history step (same as "All books"); the Preview keeps no interactive name.
- [ ] Tests: unit for each fix; `e2e/site-*.spec.ts` for M106 (clipped paint check at 390×844, GL on and `gl=0`), M107 (390 tap → "Cover", no `#p1`), M110 (1440 name link, one history step).
- **Browser check:** 390×844: tap a home book → "Cover", the cover photo painted; turn to page 1 and 2, photos painted; 1440: click the site name in the room → home, Back history one step.

## Done when

M106 e2e paints photo content on cover, page 1 and page 2 at 390×844 with WebGL on and with `gl=0`; M107 e2e opens at "Cover" with no `#p1` at 390, desktop open unchanged; M110 e2e: the 1440 room name is a link with an accessible name and cursor pointer, a click returns home in one history step, the Preview name stays non-interactive; existing site-final / site-viewer / site-lightbox specs pass unchanged; PR body lists every book-open path and GL/CSS visibility decision as fixed or left out.

Hard nos: `uikit/**`, `src/editor/publish/**`, `src/editor/EditorTopBar.tsx`, `SettingsScreen.tsx`, `ExportSiteButton.css`, `e2e/in-app-publish.spec.ts`, `.github/workflows/**`; `e2e/site-preview-mode.spec.ts` only to add an assertion; no backward compat.

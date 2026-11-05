# site-preview-embed

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-preview-embed
Status: done

## Scope

- [x] Embedded book page (Designer `site-preview-mode` spec §3, item 2): `SiteBookPage` / `SiteStage` get `embedded {slide, onSlide}` (controlled slide; no `location.hash` writes, no `hashchange`, no window key listener), `allBooks: false`, `share: false`, `renderSlide(slide, widthPx)` (stage and lightbox); all off by default
- [x] `stageWidth({…, allBooks})`: −36 px chrome when false (wide 298.85 → 262.85, narrow 294.85 → 258.85)
- [x] `useViewport(ref, { height: 'element' })`: `vh` from the element's `clientHeight`
- [x] Split `src/site/site.css` into the Tailwind/html part + `src/site/siteViewer.css` (every rule from `.site {` on, unchanged)
- **Musts:** embedded mode is controlled, writes no URL, adds no key listener (unit tests); `share`, `allBooks`, `renderSlide` props tested; `stageWidth` with `allBooks: false` unit + boundary values; `renderSitePage` snapshot unchanged; `e2e/site-viewer.spec.ts` and `e2e/site-lightbox.spec.ts` pass unchanged
- **Hard nos:** no change to the published site; no edits in `uikit/`, `src/editor/**`, `src/site/export/**`, `src/core/**`
- **Browser check:** the published sample site (`site.html?book=alps`) looks and behaves as before (no editor UI yet: item 3)
- **Test:** unit / PBT for the pure logic; existing site e2e unchanged
- **Depends:** site-lightbox

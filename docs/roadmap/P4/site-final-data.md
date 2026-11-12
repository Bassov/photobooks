# site-final-data

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-data
Status: done

Owner 2026-11-11: rework the prod personal site to the bookcase. Designer spec `personal-site` D37, D38, D40, D41, "Prod changes" P2, plus Designer parity M104 (tracker Round 22). The data layer the new home / room read; the current site UI keeps working on it unchanged.

## Scope

- [ ] `src/site/siteInput.ts`: `SiteMeta.intro?`; `SiteCatalogBook` gains `year`, `trimMm`, `pageCount`, `spine {cloth, ink, text}`, `paper`, `endpaper` (D38: size = trim mm; year = UTC year of `publishedAtMs`; pages = 2(n − 1); spine cloth = `cover.style.backFill`, text = `cover.spine.text` else the title, ink `#F1F3F6` when the cloth's relative luminance < 0.23 else `#2E2C2D`; paper = `settings.pageColor` else `#FBFAF7`; endpaper = the stand's `#E9E4DA`).
- [ ] `src/site/export/buildSiteTree.ts`: `books/<key>/book.json` = the book-page input (D41), deterministic.
- [ ] Static export ships the UI fonts (Inter Variable, Lora Variable) in `viewer/fonts/` via `scripts/vite-site-viewer-manifest.mjs`; every exported page links `fonts.css` and preloads the Latin faces with page-relative URLs (`src/site/renderSitePage.tsx` head only) (M104).
- [ ] `src/site/siteModel.ts`: phone slide list per D40 (blank pages and endpapers skipped; a spread is one whole slide when a frame crosses the gutter). Stage sizing stays while the current UI calls it.
- [ ] `src/site/sampleSite.ts`: an intro and 3 books of different formats.
- **Done when:** unit/PBT tests for D38 (size, UTC year, 2(n − 1) pages, luminance both sides of 0.23), D40 (blank skip, gutter-crossing frame → one slide), `book.json` per book and a byte-identical second export; e2e on an exported folder served statically: font files exist, `document.fonts` reports the UI fonts loaded, no 404s; existing site e2e green.
- **Browser check:** export the fixture library, serve `dist/` statically, open the home and a book page: fonts load from `viewer/fonts/`, no failed requests.
- **Hard nos:** no change to `src/render/**`, `src/site/SiteStage.tsx`, `uikit/**`, `package.json`; no backward compat (Owner 2026-11-02).

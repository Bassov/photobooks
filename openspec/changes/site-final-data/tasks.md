## Implementation

- [x] 1. `siteInput.ts` types + `siteModel.ts` `siteBookFacts` (D38) with unit / PBT tests.
- [x] 2. `siteModel.ts` `siteSlides` (D40) with unit / PBT tests.
- [x] 3. `buildSiteTree.ts`: catalog facts, `books/<key>/book.json`, page `preload`; tests incl. a byte-identical second export.
- [x] 4. Fonts: manifest plugin, `loadSiteViewerBundle` `preload`, `renderSitePage` head; tests.
- [x] 5. `sampleSite.ts`: intro + a third square book; site-viewer e2e count.
- [x] 6. e2e: served export loads the UI fonts from `viewer/fonts/`, no 4xx.

## Manual test scenarios

1. Export the fixture library, serve `dist/`, open the home and a book page: Inter / Lora load from `viewer/fonts/`, no failed requests.
   - OK: `e2e/static-export-viewer.spec.ts` "a served export ships the UI fonts and every page loads them" walks this in Chromium against a plain static server (`viewer/fonts/fonts.css` + 9 woff2; `document.fonts` reports Inter Variable and Lora Variable loaded on `/` and `books/<key>/`; no failed requests). The agent manual-qa cannot export to OPFS and serve `dist/`, so the e2e walk is the evidence.

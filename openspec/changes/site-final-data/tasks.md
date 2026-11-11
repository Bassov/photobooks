## Implementation

- [ ] 1. `siteInput.ts` types + `siteModel.ts` `siteBookFacts` (D38) with unit / PBT tests.
- [ ] 2. `siteModel.ts` `siteSlides` (D40) with unit / PBT tests.
- [ ] 3. `buildSiteTree.ts`: catalog facts, `books/<key>/book.json`, page `preload`; tests incl. a byte-identical second export.
- [ ] 4. Fonts: manifest plugin, `loadSiteViewerBundle` `preload`, `renderSitePage` head; tests.
- [ ] 5. `sampleSite.ts`: intro + a third square book; site-viewer e2e count.
- [ ] 6. e2e: served export loads the UI fonts from `viewer/fonts/`, no 4xx.

## Manual test scenarios

1. Export the fixture library, serve `dist/`, open the home and a book page: Inter / Lora load from `viewer/fonts/`, no failed requests.

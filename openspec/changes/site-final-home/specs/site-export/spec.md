## MODIFIED Requirements

### Requirement: Viewer bundle in every export

The production build SHALL emit `site-viewer.json` listing the site viewer entry's files (entry chunk, static imports, CSS, assets, and the dynamic-import closure the pages load lazily — the home's GL books and three — copied but not linked; the sample shell and perf hooks left out) plus the UI fonts (`fonts/fonts.css` first among the CSS, its font files, and the Latin faces to preload, the home's Site Inter Display Latin face included). JS-hosted URLs (lazy imports and their preload dependencies) SHALL resolve relative to the importing chunk. Every Export SHALL load those files into the worker request's `viewer`, with root-absolute CSS `url(/…)` rewritten relative to `viewer/` and their files included, so every exported page links the viewer CSS, the fonts stylesheet and JS and preloads the Latin font faces with page-relative URLs; a missing manifest or file SHALL fail the export with `unknown`.

#### Scenario: Served export

- **WHEN** an exported `dist/` is served by a plain static server and a book page is opened
- **THEN** the viewer CSS applies, the next page turns, and no asset request 404s

#### Scenario: Served export fonts

- **WHEN** the home and a book page of a served export are opened
- **THEN** the font files exist under `viewer/fonts/`, `document.fonts` reports "Inter Variable" and "Lora Variable" loaded and "Site Inter Display" checks for Cyrillic text, and no request (the home's lazy GL chunks included) fails

## MODIFIED Requirements

### Requirement: Viewer bundle in every export

The production build SHALL emit `site-viewer.json` listing the site viewer entry's files (entry chunk, static imports, CSS, assets) plus the UI fonts (`fonts/fonts.css` first among the CSS, its font files, and the Latin faces to preload). Every Export SHALL load those files into the worker request's `viewer`, with root-absolute CSS `url(/…)` rewritten relative to `viewer/` and their files included, so every exported page links the viewer CSS, the fonts stylesheet and JS and preloads the Latin font faces with page-relative URLs; a missing manifest or file SHALL fail the export with `unknown`.

#### Scenario: Served export

- **WHEN** an exported `dist/` is served by a plain static server and a book page is opened
- **THEN** the viewer CSS applies, the next page turns, and no asset request 404s

#### Scenario: Served export fonts

- **WHEN** the home and a book page of a served export are opened
- **THEN** the font files exist under `viewer/fonts/` and `document.fonts` reports "Inter Variable" and "Lora Variable" loaded

## ADDED Requirements

### Requirement: Site book data

Every catalog book SHALL carry the site book data of its published revision: `trimMm`, the UTC `year` of `publishedAtMs`, `pageCount` = 2(n − 1), `spine {cloth: cover back fill, text: spine text else the title, ink}` with ink `#F1F3F6` when the cloth's relative luminance is below 0.23 and `#2E2C2D` otherwise, `paper` = the book's page colour else `#FBFAF7`, and `endpaper` `#E9E4DA`. Each book SHALL also get `books/<key>/book.json`: the book-page input with its catalog entry, key-sorted, next to its `index.html`.

#### Scenario: Book data file

- **WHEN** a library with two published books is exported
- **THEN** each book directory holds `book.json` whose `entry` has that book's year, page count and spine

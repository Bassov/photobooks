# site-export Specification

## Purpose

Builds the static site of a library as a pure, deterministic in-memory file tree: published books from their frozen revisions, prerendered HTML, content-addressed web derivatives, the viewer bundle and a manifest, and writes it into a chosen folder's `dist/` from a module worker. The export UI belongs to `static-export`.

## Requirements

### Requirement: Deterministic site tree

The system SHALL build the static site as an in-memory tree of files sorted by path (prerendered HTML pages, content-addressed derivative files, the viewer bundle and a `site.json` manifest) from the library meta, the published revisions and the encoded derivatives, with no clock, random or locale-dependent output; the same input in any order SHALL yield byte-identical files.

#### Scenario: Export twice

- **WHEN** the same library is exported twice, with books and derivatives in a different order
- **THEN** both trees have the same paths and byte-identical files

### Requirement: Published revisions only

The system SHALL export a book only while its library status is published, and only from its frozen revision; draft books, unpublished books and edits made after publishing SHALL NOT appear, and asset metadata (GPS, captions, file names) SHALL NOT leave the library.

#### Scenario: Edit after publish

- **WHEN** a book is published, then retitled and given a new photo in the draft
- **THEN** the tree carries the published title and none of the new photo's derivatives

### Requirement: Referenced files exist

The system SHALL reference from HTML and the manifest only derivative files present in the tree, and SHALL report each wanted `(assetHash, presetId)` derivative missing from the input instead of linking it.

#### Scenario: Missing derivative

- **WHEN** a published photo has no derivative in the input
- **THEN** no page or manifest entry links it and `missing` lists that asset for every preset

### Requirement: Write into dist

The system SHALL write the site tree under `<folder>/dist/`, replacing an existing `dist/` only when its root holds our `site.json` manifest (or it is empty); after a write the `dist/` file set SHALL equal the tree's file set with identical bytes, and a `dist/` that is not ours SHALL be left unchanged with a `not-our-export` error.

#### Scenario: Foreign dist

- **WHEN** the chosen folder has a `dist/` file, or a non-empty `dist/` directory without our manifest
- **THEN** nothing in it is written or removed and the export fails with `not-our-export`

#### Scenario: Earlier export

- **WHEN** `dist/` holds an earlier export with files the new tree lacks
- **THEN** those files are removed and every tree file is written

### Requirement: Export worker

The system SHALL run `buildSiteTree` and the writes in a module worker that posts only `{phase, done, total}` progress, at most one message per 250 ms, then `{done: {books, files, bytes}}` or `{failed: {code}}` with code `permission`, `quota`, `not-our-export` or `unknown`.

### Requirement: Viewer bundle in every export

The production build SHALL emit `site-viewer.json` listing the site viewer entry's files (entry chunk, static imports, CSS, assets, and the dynamic-import closure the pages load lazily — the home's GL books and three — copied but not linked; the sample shell and perf hooks left out) plus the UI fonts (`fonts/fonts.css` first among the CSS, its font files, and the Latin faces to preload, the home's Site Inter Display Latin face included). JS-hosted URLs (lazy imports and their preload dependencies) SHALL resolve relative to the importing chunk. Every Export SHALL load those files into the worker request's `viewer`, with root-absolute CSS `url(/…)` rewritten relative to `viewer/` and their files included, so every exported page links the viewer CSS, the fonts stylesheet and JS and preloads the Latin font faces with page-relative URLs; a missing manifest or file SHALL fail the export with `unknown`.

#### Scenario: Served export

- **WHEN** an exported `dist/` is served by a plain static server and a book page is opened
- **THEN** the viewer CSS applies, the next page turns, and no asset request 404s

#### Scenario: Served export fonts

- **WHEN** the home and a book page of a served export are opened
- **THEN** the font files exist under `viewer/fonts/`, `document.fonts` reports "Inter Variable" and "Lora Variable" loaded and "Site Inter Display" checks for Cyrillic text, and no request (the home's lazy GL chunks included) fails

### Requirement: Site book data

Every catalog book SHALL carry the site book data of its published revision: `trimMm`, the UTC `year` of `publishedAtMs`, `pageCount` = 2(n − 1), `spine {cloth: cover back fill, text: spine text else the title, ink}` with ink `#F1F3F6` when the cloth's relative luminance is below 0.23 and `#2E2C2D` otherwise, `paper` = the book's page colour else `#FBFAF7`, and `endpaper` `#E9E4DA`. Each book SHALL also get `books/<key>/book.json`: the book-page input with its catalog entry, key-sorted, next to its `index.html`.

#### Scenario: Book data file

- **WHEN** a library with two published books is exported
- **THEN** each book directory holds `book.json` whose `entry` has that book's year, page count and spine

### Requirement: Export site from the editor

The editor top bar SHALL show an "Export site" pill (after Settings, before Publish) that opens a dialog (Options → Running → Done / Failed) and writes the site into `<chosen folder>/dist/` through the export worker. Export SHALL freeze the open book with `publishBook` at the moment Export is pressed (library-backed: `library.json` and `published.json` saved) and export it with the other published revisions, with web derivatives of every shown photo (a photo without `contentHash` is hashed from its source bytes during the run); edits made during the run go into the next export. One export runs at a time, and Export site is disabled while Publish runs; the running dialog can be hidden (Hide, Esc, outside click) and the pill then shows `NN%` over a fill, "Exported" for 4 s, or "Failed" until opened. The pill keeps the width of its rest content in every state (icon-only below 1360 px), its accessible name stays "Export site", and a status region announces progress at most every 10 %. The chosen folder handle SHALL be remembered per library in the session IndexedDB and readwrite permission re-requested on Export. Nothing is uploaded.

#### Scenario: Export while editing

- **WHEN** the user picks a folder, presses Export, hides the dialog and drags a frame while the export runs
- **THEN** `dist/index.html` is written with only published books, `dist/assets/` holds a file for every placed photo (also photos with no `contentHash`), the pill rect is the same in idle, running and done, and the drag has no long animation frame from our code

#### Scenario: Export again

- **WHEN** the same unchanged book is exported twice into the same folder
- **THEN** the second `dist/` is byte-identical to the first

#### Scenario: Foreign dist

- **WHEN** the chosen folder holds a `dist/` that is not a Photobooks export
- **THEN** the dialog shows the "isn't a Photobooks export" text, its primary action goes back to choosing a folder, and the foreign `dist/` is unchanged

### Requirement: Site settings in export and publish

Export site and Publish SHALL build every page from the library's `site` settings (title, else "Photobooks"; author; intro; theme). Publish SHALL add the canonical `url` from Hosting's `publicBaseUrl` without a trailing slash; Export to a folder has no url. Without site settings the output SHALL equal the title-only default.

#### Scenario: Exported home uses the site settings

- **WHEN** a library with `site: { title: 'Alps & Sea', author: 'Ann' }` is exported
- **THEN** the home `<title>` names "Alps & Sea" and its lead reads "Photobooks by Ann."

### Requirement: Site settings are saved to the library

The editor SHALL store site settings edits in `library.json` read-modify-write, one write at a time in call order, with no write when the normalised value is unchanged. A failed write SHALL show "Couldn't save site settings to the library folder" and keep the values for the session.

#### Scenario: Unchanged value writes nothing

- **WHEN** the author is set to `' Ann '` while the stored author is `Ann`
- **THEN** `library.json` is not written

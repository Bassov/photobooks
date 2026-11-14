# site-viewer Specification

## Purpose

The static site viewer: prerendered catalog and book pages (`renderSitePage`) that the `site.html` entry hydrates, with the reading room, Share, the lightbox and phone layouts. Building the site tree belongs to `site-export`.

## Requirements

### Requirement: Prerendered, hydrated site pages

The system SHALL render every exported site page (catalog, book) as one complete, deterministic HTML document whose `#site-root` markup is the same React tree the viewer entry hydrates, followed by the page input as `#site-data` JSON with sorted keys and `<` escaped; the same input SHALL give a byte-identical document, and asset records SHALL NOT carry paths, captions or GPS.

#### Scenario: Render twice

- **WHEN** the same book page input is rendered twice
- **THEN** both documents are byte-identical and contain no source path, caption or GPS of an asset

### Requirement: Book viewer slides

The book page SHALL be the reading room (`site-room`): an open book with views 0 cover, 1…n spreads and n + 1 back cover, labelled `Cover`, `Page 1 of N`, `Pages a–b of N`, `Back cover`. On desktop the reader turns a page per step (Previous / Next, ←/→ when the reader is ≥ 50 % in view, a click on a page half, a drag) and the foot row (top h − 54, h 44) holds the about block (title 16, meta 13 grey) at x 24, the pager centred at w / 2, then Share · Fullscreen · Play right-aligned to w − 24 with 24 px gaps. Phones get the page turn (`?reader=carousel` → the carousel) over the D40 slide list, with no Previous / Next. Views 0…n SHALL be kept in the hash as `#p{first page}` via `replaceState` (`#pN` opens the view holding page N, unknown → cover). Without WebGL2 or with `?gl=0` the reader SHALL draw the CSS book; three.js SHALL load only in a lazy chunk.

#### Scenario: Deep link

- **WHEN** a book page with 11 spreads opens at `#p6` at 1440 × 900
- **THEN** the label reads `Pages 6–7 of 20`, the foot row top is 846 and Play's right edge is 1416

#### Scenario: Phone room

- **WHEN** a portrait book opens at 390 × 844
- **THEN** the header row is at y 128.25 (h 44) with "‹ Title" at x 16, Play's right edge is 374, Share's right edge is Play's left − 20 and the stage top is 180.25

### Requirement: Share

Share SHALL be a text button (`site-share`) that uses `navigator.share` when the pointer is coarse and the API exists, otherwise copies the canonical book URL; after copying it SHALL read "Copied" for 2000 ms without changing its width (both labels in one grid cell, the inactive one hidden) and the "Copied" label SHALL be `aria-live="polite"`.

#### Scenario: Copy link

- **WHEN** Share is pressed with a fine pointer
- **THEN** the clipboard holds the book URL, the button reads "Copied" at the same width and reads "Share" again after 2000 ms

### Requirement: Fullscreen lightbox

On desktop the Fullscreen button (`site-fullscreen-btn`) SHALL open a fullscreen lightbox (the presentation pager's `lightbox` variant) over the spreads: the cover opens slide 0, view v opens slide v − 1 and the back cover the last spread. Each slide SHALL fit the viewport minus 64 top / 48 bottom / 64 sides (8 without a hover pointer) so no control covers it at zoom 1; ←/→/Space, Home/End, arrows (hover pointers only, hidden at the ends) and a swipe over 60 px SHALL step; zoom SHALL stay in 1–3× by transform only (double-click / tap toggles 1 ↔ 2 about the point, Ctrl+wheel / pinch about the cursor, `+`/`-`/`0`), panning clamped to the fit area; a step SHALL open the next slide at 1×; Esc or the X SHALL close at any zoom, show the lightbox slide's view in the room with no turn animation and focus Fullscreen. Photo `sizes` SHALL follow the painted width × zoom and never shrink while open. Phones SHALL have no Fullscreen.

#### Scenario: Open and fit

- **WHEN** Fullscreen is pressed on the Alps book's cover at 1440 × 900
- **THEN** the active spread is 1301.91 × 788 at (69.04, 64) and no control rect intersects it

#### Scenario: Zoom then close

- **WHEN** the spread is double-clicked, the lightbox steps to slide 3 and Esc is pressed
- **THEN** `data-zoom` read `2.00` with the clicked point fixed, the room shows view 4 without a turn and focus is on Fullscreen

### Requirement: Narrow layout

Desktop rooms ≤ 640 px wide SHALL use the narrow foot (pager on its own row, about + buttons below); phones (portrait < 768 px wide, or landscape < 500 px high) SHALL use the phone room; at ≤ 640 px the home SHALL use the phone bookcase (name at 16 / 16, lead at 16 / 72, case at 16 / 184 between 16 px margins). Neither SHALL have page-level horizontal scroll or an element past the viewport's right edge.

#### Scenario: Phone

- **WHEN** the home and a book page open at 390 × 844
- **THEN** `scrollWidth` equals `clientWidth` and no element's right edge exceeds 390

### Requirement: Embedded book page

The room SHALL accept an embedded mode for hosts such as the editor preview: `embedded { slide, onSlide }` makes the view controlled and SHALL NOT write the URL, listen to `hashchange` or add a `window` keydown listener; its head name (`author`, else the site title) is plain text, not a link; `allBooks: false` hides "All books"; `share: false` hides Share; `renderSlide(slide, widthPx)` replaces the page paint (the CSS reader is used) on the reader and in the lightbox. All are off by default and the published site SHALL render unchanged.

#### Scenario: Embedded step

- **WHEN** an embedded room at view 0 gets Next
- **THEN** `onSlide(1)` is called, the hash and history are untouched, and ArrowRight on the window does nothing

### Requirement: Phone slide list

The system SHALL derive a book's phone slides from its spreads (parent frames included): one slide per page with any frame on it, blank pages and endpapers skipped, and a two-page spread as one whole slide when any frame crosses the gutter.

#### Scenario: Panorama and blank page

- **WHEN** a book has a spread whose frame crosses the gutter and a page with no frames
- **THEN** the panorama spread is one whole slide and the blank page has no slide

### Requirement: Lazy GL book renderer

The site SHALL ship the stand's WebGL book (closed book, open book, page curl; three r170 vendored) only in lazily imported chunks: the `site` entry and its static imports SHALL stay ≤ 200 KB of gzipped script and contain no GL module. The renderer SHALL take a GL-local input (cover panels, cloth, page count, trim, paper default `#FBFAF7`, endpaper default `#E9E4DA`, a face provider); the thickness SHALL follow the stand's rule for the page count plus two endpapers. Faces SHALL be painted with the page painter lazily, pages of the focused view and views ± 2 first, grain after painting, one page at a time, never in the requesting task: painting (clipped) and grain SHALL each go one row band per task (endpaper grain too), with no long task over 50 ms for 6 faces at 2×.

#### Scenario: Face order

- **WHEN** faces of pages 0, 9 and 4 are requested and view 3 is focused
- **THEN** page 4 paints before pages 0 and 9

### Requirement: Bookcase home

The site home SHALL show the head name (`author`, else the site title), the lead (`intro`, else `Photobooks by {author}.`, else none) and the bookcase: every published book once, as a link to its book page, on shelves laid out by the kit's shelf rules, in "Site Inter Display" on `#f4f3f0` (html, body and `theme-color`). With no books it SHALL say "No published books yet." and show no case.

#### Scenario: Home checkpoints

- **WHEN** the home opens at 1440 × 900
- **THEN** the name sits at x 24, y 20; the lead at x 141.33, y 104, 640 wide; the case at x 141.33, 1157.33 wide, 40 below the lead; every book is an `<a href>` to its book page

### Requirement: Home prerender and GL books

The prerendered case SHALL stay hidden until the first client layout, so nothing shifts after hydration. Face-out books SHALL be CSS objects that the lazily loaded GL book replaces in place after the first idle following `load`; `?gl=0` or no WebGL2 SHALL keep the CSS objects.

#### Scenario: No GL

- **WHEN** the home opens with `?gl=0`
- **THEN** every face-out book stays a CSS object and no GL canvas is drawn

### Requirement: Room navigation

A plain click on a home book SHALL open the room over the home (fade 240 ms, the cover turns at once) from the book's `book.json` (fetched on pointerenter / focus, reused on click) and push the book URL; Back, Esc and "All books" (`site-all-books`, right edge w − 24, y 20) SHALL return to the home with one history step. A book URL loaded directly SHALL open the room at the cover (or its `#pN` view) with "All books" a plain link to the home.

#### Scenario: One history step

- **WHEN** a home book is clicked and then Esc is pressed
- **THEN** the URL is the book's while open, the home URL after, and `history.length` grew by exactly 1

### Requirement: Book page prerender

The book page HTML SHALL prerender the room at 1440 × 900 with a CSS closed cover and the foot row (title, meta, pager label, Share, Fullscreen, Play) before scripts run; html, body and `meta[name=theme-color]` SHALL be `rgb(244, 243, 240)`.

#### Scenario: No script

- **WHEN** a published book page is loaded with JavaScript disabled
- **THEN** the title, the meta and the label `Cover` are in the foot row

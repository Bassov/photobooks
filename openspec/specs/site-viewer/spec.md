# site-viewer Specification

## Purpose

The static site viewer: prerendered catalog and book pages (`renderSitePage`) that the `site.html` entry hydrates, with slides, a constant stage, Share and a narrow layout. Building the site tree belongs to `site-export`.

## Requirements

### Requirement: Prerendered, hydrated site pages

The system SHALL render every exported site page (catalog, book) as one complete, deterministic HTML document whose `#site-root` markup is the same React tree the viewer entry hydrates, followed by the page input as `#site-data` JSON with sorted keys and `<` escaped; the same input SHALL give a byte-identical document, and asset records SHALL NOT carry paths, captions or GPS.

#### Scenario: Render twice

- **WHEN** the same book page input is rendered twice
- **THEN** both documents are byte-identical and contain no source path, caption or GPS of an asset

### Requirement: Book viewer slides

The book page SHALL show the cover then every spread as slides (spreads + 1), labelled `Cover`, then `{page label} · {s} / {n}`, inside a stage whose size depends only on the viewport and the trim, never on the slide; ←/→, Home/End, Prev/Next and swipe SHALL step, and the slide SHALL be kept in the hash as `#p{first page}` via `replaceState` (`#pN` opens the spread holding page N, unknown → cover).

#### Scenario: Deep link

- **WHEN** a book page with 11 spreads opens at `#p6`
- **THEN** the indicator reads `Pages 6–7 · 4 / 11` and the stage rect equals the cover's

### Requirement: Share

Share SHALL use the native share sheet when available and otherwise copy the canonical book URL; the button SHALL then read "Link copied" for 2000 ms without changing its width, and a status region SHALL announce the link.

#### Scenario: Copy link

- **WHEN** Share is pressed without a native share sheet
- **THEN** the label reads "Link copied" at the same button width and reads "Share" again after 2000 ms

### Requirement: Fullscreen lightbox

The book page SHALL open a fullscreen lightbox (the presentation pager's `lightbox` variant) on the current slide from a Fullscreen button next to Share and from a click on the stage (a swipe steps, never opens). Each slide SHALL fit the viewport minus 64 top / 48 bottom / 64 sides (8 without a hover pointer) so no control covers it at zoom 1; ←/→/Space, Home/End, arrows (hover pointers only, hidden at the ends) and a swipe over 60 px SHALL step; zoom SHALL stay in 1–3× by transform only (double-click / tap toggles 1 ↔ 2 about the point, Ctrl+wheel / pinch about the cursor, `+`/`-`/`0`), panning clamped to the fit area; a step SHALL open the next slide at 1×; Esc or the X SHALL close at any zoom, return the book page to the lightbox's slide and focus the opener. Photo `sizes` SHALL follow the painted width × zoom and never shrink while open.

#### Scenario: Open and fit

- **WHEN** Fullscreen is pressed on the Alps book at 1440 × 900
- **THEN** the active spread is 1301.91 × 788 at (69.04, 64) and no control rect intersects it

#### Scenario: Zoom then close

- **WHEN** the spread is double-clicked and Esc is pressed
- **THEN** `data-zoom` reads `2.00` with the clicked point fixed, and Esc closes with focus back on the opener

### Requirement: Narrow layout

Below 768 px the site SHALL use the narrow layout (20 px padding, two catalog columns, Share under the meta) with no page-level horizontal scroll and no element past the viewport's right edge.

#### Scenario: Phone

- **WHEN** the catalog and a book page open at 390 × 844
- **THEN** `scrollWidth` equals `clientWidth` and no element's right edge exceeds 390

### Requirement: Embedded book page

The book page SHALL accept an embedded mode for hosts such as the editor preview: `embedded { slide, onSlide }` makes the slide controlled and SHALL NOT write the URL, listen to `hashchange` or add a `window` keydown listener; `allBooks: false` hides the All books link and gives its 36 px to the stage; `share: false` hides Share; `renderSlide(slide, widthPx)` replaces the slide paint on the stage and in the lightbox. All are off by default and the published site SHALL render unchanged.

#### Scenario: Embedded step

- **WHEN** an embedded book page at slide 0 gets Next
- **THEN** `onSlide(1)` is called, the hash and history are untouched, and ArrowRight on the window does nothing

### Requirement: Phone slide list

The system SHALL derive a book's phone slides from its spreads (parent frames included): one slide per page with any frame on it, blank pages and endpapers skipped, and a two-page spread as one whole slide when any frame crosses the gutter.

#### Scenario: Panorama and blank page

- **WHEN** a book has a spread whose frame crosses the gutter and a page with no frames
- **THEN** the panorama spread is one whole slide and the blank page has no slide

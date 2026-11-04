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

### Requirement: Narrow layout

Below 768 px the site SHALL use the narrow layout (20 px padding, two catalog columns, Share under the meta) with no page-level horizontal scroll and no element past the viewport's right edge.

#### Scenario: Phone

- **WHEN** the catalog and a book page open at 390 × 844
- **THEN** `scrollWidth` equals `clientWidth` and no element's right edge exceeds 390

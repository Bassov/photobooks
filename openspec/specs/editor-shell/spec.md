# editor-shell Specification

## Purpose

Editor chrome that presents a workspace above a book-gallery filmstrip, and lets the user import local folders or files into that gallery with visible progress.

## Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip. The shell MUST replace the previous single photo-card screen as the primary app surface.

#### Scenario: Shell visible on load

- **WHEN** the user opens the app
- **THEN** a workspace region and a filmstrip region are visible, and the legacy single photo-card success screen is not the primary layout

### Requirement: Import folder or files into gallery

The system SHALL let the user add a local folder or individual image files to the book gallery. When a directory picker is available, the system MUST prefer it for folder import and MUST also provide a file-input path suitable for automated tests (including directory selection where the platform supports it). Accepted types remain JPEG, PNG, and WebP. Import MUST append assets without clearing prior gallery entries.

#### Scenario: Import files via input fallback

- **WHEN** supported image files are supplied through the test file input
- **THEN** those assets appear in the filmstrip gallery in append order

#### Scenario: Second import appends

- **WHEN** the user imports additional supported files after a first import
- **THEN** the gallery retains the earlier assets and appends the new ones

#### Scenario: Reject unsupported type in a batch

- **WHEN** a batch includes a TIFF among supported images
- **THEN** supported images still enter the gallery and a visible per-file error is shown for the TIFF without aborting the batch

### Requirement: Filmstrip placeholders and thumbnails

The filmstrip SHALL list gallery assets horizontally with virtualization for long galleries. Each filmstrip item MUST size its slot from the asset’s aspect (fixed height, width derived from clamped aspect) so landscape, portrait, square, and non-standard ratios are visually distinct. Each new asset MUST show an aspect-ratio placeholder before its thumbnail is ready. Thumbnails MUST be orientation-corrected pre-sized previews that show the full photo within the slot (no default cover crop) and MUST load with asynchronous decoding. The system MUST keep object URLs for thumbnails in a bounded cache and MUST revoke URLs on eviction. During an active multi-file import the filmstrip MUST expose newly enqueued gallery ids as they become part of the gallery (paced so interaction stays within frame-budget gates); it MUST NOT withhold the full batch until import settles. The system MAY reserve scroll extent via a progress spacer for the expected batch size.

#### Scenario: Placeholder then thumbnail

- **WHEN** a supported image enters the gallery during or after import (including a single-file import)
- **THEN** a filmstrip item appears with a placeholder and later shows a preview thumbnail without requiring a full page reload

#### Scenario: Placeholders appear during multi-file import

- **WHEN** a multi-file import is running and gallery ids have been enqueued for accepted files
- **THEN** the filmstrip’s visible gallery count increases before the import progress reaches completion, and placeholders are available to scroll without waiting for the whole batch to finish

#### Scenario: Scroll a long gallery

- **WHEN** the gallery contains far more assets than fit on screen
- **THEN** the user can scroll the filmstrip horizontally and only near-viewport items need live thumbnail resources

#### Scenario: Portrait and landscape slots differ

- **WHEN** the gallery contains a portrait asset and a landscape asset with known corrected dimensions
- **THEN** the portrait filmstrip item is narrower than the landscape item at the same thumb height

#### Scenario: Full photo visible in thumb slot

- **WHEN** a thumbnail is ready for a non-square asset
- **THEN** the preview shows the entire photo within the item slot without cropping by default

### Requirement: Import progress

While a multi-file import is in progress, the system SHALL expose visible progress (completed vs total, or equivalent) on the filmstrip status strip and MUST continue accepting filmstrip scroll interaction. The filmstrip status strip MUST also show the current gallery photo count when the gallery is non-empty or an import is running.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress feedback is visible on the filmstrip status strip and the filmstrip remains scrollable

#### Scenario: Gallery count on status strip

- **WHEN** the gallery contains one or more assets
- **THEN** the filmstrip status strip shows the total photo count

### Requirement: Viewport-contained shell and filmstrip scroll

The editor shell SHALL fill the viewport without creating page-level horizontal or vertical scrollbars. When the gallery is longer than the visible filmstrip, horizontal scrolling MUST occur only inside the filmstrip scrollport, not by widening the document.

#### Scenario: Long gallery does not widen the page

- **WHEN** the gallery contains far more assets than fit on screen (including after a bulk import)
- **THEN** `document.documentElement.scrollWidth` MUST NOT exceed `document.documentElement.clientWidth`, and `document.documentElement.scrollHeight` MUST NOT exceed `document.documentElement.clientHeight` at the default desktop viewport

#### Scenario: Filmstrip is the horizontal scrollport

- **WHEN** the gallery is longer than the visible filmstrip region
- **THEN** the filmstrip scroll element has `scrollWidth` greater than `clientWidth`, and changing its `scrollLeft` scrolls the gallery without requiring document horizontal scroll

### Requirement: Workspace hosts the pasteboard

The editor workspace SHALL show the book's pasteboard. It MUST NOT show a placeholder sentence in place of that pasteboard.

#### Scenario: Workspace is not a placeholder

- **WHEN** the user opens the app
- **THEN** the workspace shows the pasteboard and does not show a sentence that the pasteboard arrives later

### Requirement: Active spread template and add spread

The editor SHALL offer a keyboard-reachable control that sets the active spread's template to full-bleed, one-per-page, 2-up, or 4-grid, and a keyboard-reachable control that appends a spread. The template control MUST show the active spread's current template. The appended spread MUST use the one-per-page template and MUST be brought into the pasteboard scrollport. These controls MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread
- **THEN** the pasteboard spread count increases by one, the new spread uses one-per-page, and that spread lies within the pasteboard scrollport

#### Scenario: Template controls do not scroll the page

- **WHEN** the template control and the add-spread control are visible
- **THEN** the document element does not gain horizontal or vertical page scroll

### Requirement: Camera zoom controls

The editor SHALL offer keyboard-reachable controls for fit spread, fit width, and 100% physical size, plus a zoom indicator of the current zoom as a percent of physical size (96 CSS pixels per inch). These controls MUST NOT create page-level horizontal or vertical scroll. 100% MUST size a millimetre at 96 CSS pixels per inch.

#### Scenario: 100% shows physical size

- **WHEN** the user chooses 100%
- **THEN** the indicator reads 100% and the active spread's on-screen millimetres match 96 CSS pixels per inch

#### Scenario: Fit width matches the port

- **WHEN** the user chooses fit width
- **THEN** the active spread's width matches the pasteboard port width and the indicator shows the resulting physical-size percent

#### Scenario: Fit spread fits in the port

- **WHEN** the user chooses fit spread
- **THEN** the active spread fits inside the pasteboard port

#### Scenario: Camera controls do not scroll the page

- **WHEN** the camera controls and the zoom indicator are visible
- **THEN** the document element does not gain horizontal or vertical page scroll

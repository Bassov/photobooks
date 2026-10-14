## Purpose

Editor chrome that presents a workspace above a book-gallery filmstrip, and lets the user import local folders or files into that gallery with visible progress.

## ADDED Requirements

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

The filmstrip SHALL list gallery assets horizontally with virtualization for long galleries. Each new asset MUST show an aspect-ratio placeholder before its thumbnail is ready. Thumbnails MUST be orientation-corrected pre-sized previews loaded with asynchronous decoding. The system MUST keep object URLs for thumbnails in a bounded cache and MUST revoke URLs on eviction.

#### Scenario: Placeholder then thumbnail

- **WHEN** a supported image import batch completes (or a single-file import finishes)
- **THEN** a filmstrip item appears with a placeholder and later shows a preview thumbnail without requiring a full page reload

During an active multi-file import the filmstrip may freeze its visible id list (keeping already-imported assets) and reserve scroll extent via progress spacer so GridList does not remount per chunk; new ids enter the strip after the batch settles.

#### Scenario: Scroll a long gallery

- **WHEN** the gallery contains far more assets than fit on screen
- **THEN** the user can scroll the filmstrip horizontally and only near-viewport items need live thumbnail resources

### Requirement: Import progress

While a multi-file import is in progress, the system SHALL expose visible progress (completed vs total, or equivalent) and MUST continue accepting filmstrip scroll interaction.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress feedback is visible and the filmstrip remains scrollable

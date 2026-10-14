# Spec Delta

## MODIFIED Requirements

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

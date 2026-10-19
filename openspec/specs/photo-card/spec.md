# photo-card Specification

## Purpose

Lets the user import local images into the editor gallery filmstrip with worker-based decode/EXIF, or show a clear per-file error for unsupported types.

## Requirements

### Requirement: Open a local image file

The system SHALL let the user choose local image files (one or many) or a folder for import into the editor gallery. When the File System Access API is available, the system MUST prefer it for picking. The system MUST also provide a file input path suitable for automated tests.

#### Scenario: Open via primary picker

- **WHEN** the user activates Add photos or Add folder and the File System Access API is available
- **THEN** the system presents the appropriate picker and imports chosen images into the gallery filmstrip flow

#### Scenario: Open via file input fallback

- **WHEN** supported image files are supplied through the hidden file input
- **THEN** the system imports those files into the same gallery filmstrip flow as the primary picker

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, and WebP images. The system MUST reject other types, including TIFF, and MUST show a visible per-file error without treating the rejected file as a successful gallery entry. A rejected file in a batch MUST NOT abort import of other accepted files.

#### Scenario: Accept JPEG

- **WHEN** the user imports an `image/jpeg` file
- **THEN** the system adds that asset to the gallery filmstrip

#### Scenario: Reject TIFF

- **WHEN** the user imports an `image/tiff` file
- **THEN** the system shows a visible unsupported-format error for that file and does not add it as a successful gallery asset

### Requirement: Filmstrip asset representation

After a successful import of an asset, the system SHALL represent it in the filmstrip with an orientation-corrected preview thumbnail once ready. Corrected pixel dimensions and aspect metadata MUST be available for that asset for later layout use. The visible filmstrip item silhouette MUST reflect that aspect (clamped) so orientation and non-standard ratios are distinguishable without opening the asset.

#### Scenario: Filmstrip shows orientation-corrected preview

- **WHEN** a supported image with non-default EXIF orientation imports successfully
- **THEN** the filmstrip thumbnail is displayed with that orientation applied so the subject appears upright

#### Scenario: Aspect metadata available after import

- **WHEN** a supported image imports successfully
- **THEN** corrected width and height (or equivalent aspect) for that asset are retained for layout consumers

#### Scenario: Card shows metadata

- **WHEN** a supported image imports successfully
- **THEN** corrected dimensions and aspect are retained for that asset (legacy card UI is not required)

#### Scenario: Preview respects EXIF orientation

- **WHEN** the image has a non-default EXIF orientation
- **THEN** the filmstrip preview is displayed with that orientation applied so the subject appears upright

#### Scenario: Filmstrip silhouette reflects aspect

- **WHEN** a supported image imports successfully and corrected aspect is known
- **THEN** the filmstrip item’s visible width-to-height silhouette matches that aspect within the filmstrip’s clamp limits

### Requirement: Main-thread budget on gallery import

Image decode and preview preparation for import MUST NOT run as blocking work on the main thread. An automated scenario that imports many photos into the filmstrip while scrolling MUST record zero LoAF entries during the scenario window (under the project's calibrated CDP CPU throttling when run in CI).

#### Scenario: Bulk filmstrip import stays within LoAF budget

- **WHEN** ~200 supported images are imported through the gallery filmstrip flow while the filmstrip is scrolled in the LoAF scenario test
- **THEN** no LoAF entry is recorded during the scenario window

#### Scenario: Large JPEG import stays within LoAF budget

- **WHEN** a large JPEG is included in a filmstrip import LoAF scenario
- **THEN** no LoAF entry is recorded during the scenario window

### Requirement: Library-backed import streams identity before body reads

When importing into a library-backed book, the system SHALL enqueue gallery placeholders and start decode from cheap file identity fields (`relativePath`, size, mtime) without waiting for every selected file's body to be read. Reading bytes for library seed and content hash MUST run per file with at most sixteen body reads in flight at once. The system MUST NOT block the whole selection behind a single all-files body-read barrier on the main thread.

#### Scenario: Placeholders appear before body reads finish

- **WHEN** the user imports multiple supported images into a library-backed book and body reads are slow or pending
- **THEN** gallery placeholders and import progress are visible while at least one accepted file's body has not finished reading

#### Scenario: Body reads are capped

- **WHEN** more than sixteen files are imported into a library-backed book
- **THEN** at most sixteen `arrayBuffer` (or equivalent body) reads are in flight at any moment during that import

### Requirement: Session-to-library upgrade caps body reads

When upgrading session-only gallery assets into library identity, the system MUST read file bodies with at most sixteen reads in flight and MUST NOT block the whole upgrade set behind a single all-files body-read barrier.

#### Scenario: Upgrade reads are capped

- **WHEN** more than sixteen session assets are upgraded into a library
- **THEN** at most sixteen body reads are in flight at any moment during that upgrade

### Requirement: Re-import reuses matching assets and restores thumbnails

Re-importing files that already belong to the book (same relative path, byte size, and mtime, or matching content hash) MUST NOT create duplicate gallery entries. The system MUST reuse the existing asset ids and MUST restore orientation-corrected thumbnails for those assets when DerivedCache entries were missing.

#### Scenario: Re-import keeps gallery count and asset ids

- **WHEN** the user re-imports the same N already-imported photos into a library-backed book after clearing thumbnail cache entries
- **THEN** the gallery still contains exactly those N assets with the same asset ids and thumbnails become available again

### Requirement: Library bulk re-import meets progressive and frame budgets

A library-backed re-import of ~200 already-imported photos with an empty thumbnail cache MUST expose import progress and a non-zero gallery count within the same progressive deadlines used for fresh bulk import, and MUST keep the scroll-during-import window within the project's LoAF, hot-handler p95, and INP budgets.

#### Scenario: Library re-import progressive first card

- **WHEN** ~200 already-imported photos are re-imported into a library-backed book with an empty thumbnail cache
- **THEN** import progress shows an importing state and the gallery count is greater than zero while the import is still running, within the fresh-import progressive deadlines, and time to the first gallery card is at most 1.5× a session-path import measured in the same run

#### Scenario: Library re-import scroll stays within frame budgets

- **WHEN** the filmstrip is scrolled during that library-backed bulk re-import under calibrated CPU throttling
- **THEN** the scroll-during-import window records zero LoAF entries, hot-handler p95 stays within `handlerP95Ms × cpuThrottleRate`, and INP stays within the shared INP budget

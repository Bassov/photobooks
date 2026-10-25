# photo-card Specification

## Purpose

Lets the user import local images into the editor gallery filmstrip with worker-based decode/EXIF, or show a clear per-file error for unsupported types.

## Requirements

### Requirement: Open a local image file

The system SHALL let the user choose exactly one local photo folder for the open book via `showDirectoryPicker` (Chromium File System Access). The product UI MUST NOT offer individual-file import or a hidden `<input type="file">` / `webkitdirectory` fallback. Automated tests MUST stub the directory picker (or inject an equivalent FSA directory handle), not ship a product file-input path.

#### Scenario: Open via directory picker

- **WHEN** the user activates Choose photo folder… (or Change photo folder… after confirm) and `showDirectoryPicker` is available
- **THEN** the system presents a read-mode directory picker, keeps the directory handle, and imports accepted images from that folder into the gallery filmstrip flow

#### Scenario: Test seam uses directory-picker double

- **WHEN** an automated test supplies a stubbed directory picker / fake directory handle yielding supported images
- **THEN** the system imports those images into the same gallery filmstrip flow as a real picker

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, WebP, and HEIC/HEIF images into the book gallery. TIFF and other non-accepted image-like types MUST show a visible per-file error without treating the rejected file as a successful gallery entry. JPEG and HEIC/HEIF MUST enter the gallery as placeholders (JPEG MAY show an EXIF embedded thumb from the head pass) and MUST NOT be queued for prefetch/background full-original decode; decode/encode for those types MUST run only when the asset is filmstrip-visible or book-used (placed), at visible/now priority. Until a HEIC decoder succeeds, a failed HEIC decode MUST keep the placeholder tile (MUST NOT remove it from the gallery count the way a failed JPEG decode does) and MAY surface the conversion hint. HEIC/HEIF detection remains by extension, MIME (`image/heic`, `image/heif`, and `-sequence` variants), or ISO-BMFF `ftyp` signature brands. A rejected non-HEIC file in a batch MUST NOT abort import of other accepted files. An accepted non-HEIC file whose decode fails MUST show a visible per-file import error and MUST NOT remain as a gallery file entry after that failure. PNG and WebP MAY continue to decode on the import path as today unless they share the same defer-until-now policy.

#### Scenario: Accept JPEG PNG WebP and HEIC placeholders

- **WHEN** the user imports a mix of JPEG, PNG, WebP, and HEIC/HEIF files
- **THEN** JPEG/HEIC appear as gallery placeholders (JPEG may show EXIF thumb) without aborting the batch, and PNG/WebP import as accepted types

#### Scenario: Off-screen JPEG or HEIC is not background-decoded

- **WHEN** a JPEG or HEIC/HEIF asset is in the gallery but neither filmstrip-visible nor book-used
- **THEN** the decode pool does not queue prefetch/background full-original work for that asset

#### Scenario: Visible or placed JPEG or HEIC is queued

- **WHEN** a JPEG or HEIC/HEIF gallery asset becomes filmstrip-visible or is placed on a spread
- **THEN** decode is queued at visible/now priority

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

When importing into a library-backed book, the system SHALL enqueue gallery placeholders from cheap scan identity fields (`relativePath`, size, mtime) without waiting for file bodies. Reading bytes for library seed and thumb320 decode MUST run per prioritized file with at most sixteen body reads in flight at once. The system MUST NOT block the whole selection behind a single all-files body-read barrier on the main thread. Content-hash MUST NOT be required on this hot path.

#### Scenario: Placeholders appear before body reads finish

- **WHEN** the user imports multiple supported images into a library-backed book and body reads are slow or pending
- **THEN** gallery placeholders and import progress are visible while at least one accepted file's body has not finished reading

#### Scenario: Body reads are capped

- **WHEN** more than sixteen files need body reads during library-backed import decode
- **THEN** at most sixteen `arrayBuffer` (or equivalent body) reads are in flight at any moment during that import

### Requirement: Session-to-library upgrade caps body reads

When upgrading session-only gallery assets into library identity, the system MUST read file bodies with at most sixteen reads in flight and MUST NOT block the whole upgrade set behind a single all-files body-read barrier.

#### Scenario: Upgrade reads are capped

- **WHEN** more than sixteen session assets are upgraded into a library
- **THEN** at most sixteen body reads are in flight at any moment during that upgrade

### Requirement: Re-import reuses matching assets and restores thumbnails

Re-importing files that already belong to the book (same relative path, byte size, and mtime) MUST NOT create duplicate gallery entries. The system MUST reuse the existing asset ids and MUST restore orientation-corrected thumbnails for those assets when in-session or derived thumbs were missing. Matching content hash MUST NOT be required for reuse.

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

### Requirement: WebP import survives missing EXIF size metadata

The system SHALL successfully import accepted WebP images (`image/webp`) even when EXIF/size metadata cannot be parsed from the file. Width and height MUST still be recorded from JPEG SOF when applicable or from the decoded bitmap. A failure to decode the image bytes (for example a truncated or corrupt WebP) MUST still surface as a visible per-file import error and MUST NOT leave a blank gallery tile (see Accepted and rejected image types).

#### Scenario: Lossy and lossless WebP import into the filmstrip

- **WHEN** the user imports a lossy WebP and a lossless WebP from the chosen photo folder
- **THEN** both appear in the gallery filmstrip with preview thumbnails, the gallery count includes both, no import error is shown for those files, and placing one into a frame shows a rendered `spread-frame-image` with non-zero natural width

#### Scenario: Corrupt WebP reports a decode error

- **WHEN** the user imports a truncated or otherwise undecodable WebP file
- **THEN** the system shows a visible per-file import error for that file

#### Scenario: EXIF size-parse failure still yields bitmap dimensions

- **WHEN** the photo worker processes a WebP whose EXIF size parse throws (for example "Unknown file format") but `createImageBitmap` succeeds
- **THEN** the job returns success with width and height taken from the bitmap (or SOF when present)

### Requirement: Preview preserves source alpha

Orientation-corrected preview thumbnails and zoom tiers for PNG and WebP sources MUST preserve transparent pixels (alpha channel). JPEG sources MUST continue to produce JPEG previews.

#### Scenario: Transparent PNG preview is not filled black

- **WHEN** the user imports a PNG with transparent corners and places it in a frame
- **THEN** the filmstrip thumbnail and the placed frame image show transparent corners (page/filmstrip background visible), not opaque black

#### Scenario: JPEG preview format unchanged

- **WHEN** the user imports a JPEG
- **THEN** the generated preview is labeled and encoded as `image/jpeg`

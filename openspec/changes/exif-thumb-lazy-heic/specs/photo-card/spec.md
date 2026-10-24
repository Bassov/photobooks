## MODIFIED Requirements

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, WebP, and HEIC/HEIF images into the book gallery. TIFF and other non-accepted image-like types MUST show a visible per-file error without treating the rejected file as a successful gallery entry. HEIC/HEIF MUST enter the gallery as placeholders and MUST NOT be queued for prefetch/background decode; decode/encode for HEIC/HEIF MUST run only when the asset is filmstrip-visible or book-used (placed), at visible priority. Until a HEIC decoder succeeds, a failed HEIC decode MUST keep the placeholder tile (MUST NOT remove it from the gallery count the way a failed JPEG decode does) and MAY surface the conversion hint. HEIC/HEIF detection remains by extension, MIME (`image/heic`, `image/heif`, and `-sequence` variants), or ISO-BMFF `ftyp` signature brands. A rejected non-HEIC file in a batch MUST NOT abort import of other accepted files. An accepted non-HEIC file whose decode fails MUST show a visible per-file import error and MUST NOT remain as a gallery filmstrip tile or count toward the gallery photo count. When importing from the book's photo folder, files that are not image-like (MIME not `image/*` and no image extension) MUST be skipped without a per-file import error; the editor MUST announce a single polite status summary of how many non-image files were skipped. Skipped files MUST NOT count toward import progress total or gallery photo count.

#### Scenario: Accept JPEG PNG WebP and HEIC placeholders

- **WHEN** the user imports a mix of JPEG, PNG, WebP, and HEIC/HEIF files
- **THEN** JPEG/PNG/WebP decode as today and HEIC/HEIF appear as gallery placeholders without aborting the batch

#### Scenario: Reject TIFF with per-file error

- **WHEN** the user imports a TIFF among accepted images
- **THEN** the system shows a per-file error for the TIFF, does not add a TIFF gallery tile, and still imports the accepted files

#### Scenario: Off-screen HEIC is not background-decoded

- **WHEN** a HEIC/HEIF asset is in the gallery but neither filmstrip-visible nor book-used
- **THEN** the decode pool does not queue prefetch/background work for that asset

#### Scenario: Visible or placed HEIC is queued

- **WHEN** a HEIC/HEIF gallery asset becomes filmstrip-visible or is placed on a spread
- **THEN** decode is queued at visible priority

#### Scenario: Folder skips non-images with status summary

- **WHEN** a folder import includes JPEG files and a README.md
- **THEN** JPEG assets appear in the gallery, import-errors stays empty for the README, and editor-status reports that one non-image file was skipped

## MODIFIED Requirements

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, WebP, and HEIC/HEIF images into the book gallery. TIFF and other non-accepted image-like types MUST show a visible per-file error without treating the rejected file as a successful gallery entry. JPEG and HEIC/HEIF MUST enter the gallery as placeholders (JPEG MAY show an EXIF embedded thumb from the head pass) and MUST NOT be queued for prefetch full-original decode by the import batch; during import, decode/encode for those types runs only when the asset is filmstrip-visible or book-used (placed), at visible/now priority, and after import the idle background warm lane MAY encode their thumb320 (filmstrip "Visible-window decode priority"). Until a HEIC decoder succeeds, a failed HEIC decode MUST keep the placeholder tile (MUST NOT remove it from the gallery count the way a failed JPEG decode does) and MAY surface the conversion hint. HEIC/HEIF detection remains by extension, MIME (`image/heic`, `image/heif`, and `-sequence` variants), or ISO-BMFF `ftyp` signature brands. A rejected non-HEIC file in a batch MUST NOT abort import of other accepted files. An accepted non-HEIC file whose decode fails MUST show a visible per-file import error and MUST NOT remain as a gallery file entry after that failure. PNG and WebP MAY continue to decode on the import path as today unless they share the same defer-until-now policy.

#### Scenario: Accept JPEG PNG WebP and HEIC placeholders

- **WHEN** the user imports a mix of JPEG, PNG, WebP, and HEIC/HEIF files
- **THEN** JPEG/HEIC appear as gallery placeholders (JPEG may show EXIF thumb) without aborting the batch, and PNG/WebP import as accepted types

#### Scenario: Off-screen JPEG or HEIC is not import-decoded

- **WHEN** a JPEG or HEIC/HEIF asset is in the gallery but neither filmstrip-visible nor book-used while the import runs
- **THEN** the decode pool does not queue prefetch full-original work for that asset until the import ends and the warm lane reaches it

#### Scenario: Visible or placed JPEG or HEIC is queued

- **WHEN** a JPEG or HEIC/HEIF gallery asset becomes filmstrip-visible or is placed on a spread
- **THEN** decode is queued at visible/now priority

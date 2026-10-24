## MODIFIED Requirements

### Requirement: Open a local image file

The system SHALL let the user choose exactly one local photo folder for the open book via `showDirectoryPicker` (Chromium File System Access). The product UI MUST NOT offer individual-file import or a hidden `<input type="file">` / `webkitdirectory` fallback. Automated tests MUST stub the directory picker (or inject an equivalent FSA directory handle), not ship a product file-input path.

#### Scenario: Open via directory picker

- **WHEN** the user activates Choose photo folder… (or Change photo folder… after confirm) and `showDirectoryPicker` is available
- **THEN** the system presents a read-mode directory picker, keeps the directory handle, and imports accepted images from that folder into the gallery filmstrip flow

#### Scenario: Test seam uses directory-picker double

- **WHEN** an automated test supplies a stubbed directory picker / fake directory handle yielding supported images
- **THEN** the system imports those images into the same gallery filmstrip flow as a real picker

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, and WebP images. The system MUST reject other image-like types, including TIFF and HEIC/HEIF, and MUST show a visible per-file error without treating the rejected file as a successful gallery entry. HEIC/HEIF MUST be rejected with an actionable conversion message (export as JPEG, including an iPhone Camera Formats hint), detected by file extension, MIME type (`image/heic`, `image/heif`, and `-sequence` variants), or ISO-BMFF `ftyp` signature brands. A rejected file in a batch MUST NOT abort import of other accepted files. An accepted file whose decode fails MUST show a visible per-file import error and MUST NOT remain as a gallery filmstrip tile or count toward the gallery photo count. When importing from the book's photo folder, files that are not image-like (MIME not `image/*` and no image extension) MUST be skipped without a per-file import error; the editor MUST announce a single polite status summary of how many non-image files were skipped. Skipped files MUST NOT count toward import progress total or gallery photo count. The directory scan MAY encounter HEIC/HEIF so users receive the conversion message; acceptance for decode MUST still exclude HEIC/HEIF.

#### Scenario: Accept JPEG

- **WHEN** the user imports an `image/jpeg` file from the photo folder
- **THEN** the system adds that asset to the gallery filmstrip

#### Scenario: Reject TIFF

- **WHEN** the user imports an `image/tiff` file from the photo folder
- **THEN** the system shows a visible unsupported-format error for that file and does not add it as a successful gallery asset

#### Scenario: Reject HEIC with conversion message

- **WHEN** the user imports a HEIC/HEIF file identified by extension, MIME, or `ftyp` signature
- **THEN** the system shows the HEIC conversion message for that file, does not add a gallery tile, and does not change the gallery photo count

#### Scenario: Decode failure leaves no gallery tile

- **WHEN** the user imports an accepted image whose bytes fail to decode
- **THEN** the system shows a visible per-file import error for that file, the gallery does not keep a tile for it, and the gallery photo count excludes it

#### Scenario: Folder import skips non-image files

- **WHEN** the user imports a folder that contains accepted images plus non-image files such as README.md
- **THEN** accepted images enter the gallery, non-image files produce no import-errors entry, and polite editor status summarizes how many non-image files were skipped

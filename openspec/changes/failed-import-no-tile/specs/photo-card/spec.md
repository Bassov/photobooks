## MODIFIED Requirements

### Requirement: Accepted and rejected image types

The system SHALL accept JPEG, PNG, and WebP images. The system MUST reject other types, including TIFF, and MUST show a visible per-file error without treating the rejected file as a successful gallery entry. A rejected file in a batch MUST NOT abort import of other accepted files. An accepted file whose decode fails MUST show a visible per-file import error and MUST NOT remain as a gallery filmstrip tile or count toward the gallery photo count.

#### Scenario: Accept JPEG

- **WHEN** the user imports an `image/jpeg` file
- **THEN** the system adds that asset to the gallery filmstrip

#### Scenario: Reject TIFF

- **WHEN** the user imports an `image/tiff` file
- **THEN** the system shows a visible unsupported-format error for that file and does not add it as a successful gallery asset

#### Scenario: Decode failure leaves no gallery tile

- **WHEN** the user imports an accepted image whose bytes fail to decode
- **THEN** the system shows a visible per-file import error for that file, the gallery does not keep a tile for it, and the gallery photo count excludes it

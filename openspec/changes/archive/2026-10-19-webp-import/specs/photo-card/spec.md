## ADDED Requirements

### Requirement: WebP import survives missing EXIF size metadata

The system SHALL successfully import accepted WebP images (`image/webp`) even when EXIF/size metadata cannot be parsed from the file. Width and height MUST still be recorded from JPEG SOF when applicable or from the decoded bitmap. A failure to decode the image bytes (for example a truncated or corrupt WebP) MUST still surface as a visible per-file import error (removal of any blank gallery tile after that failure is owned elsewhere).

#### Scenario: Lossy and lossless WebP import into the filmstrip

- **WHEN** the user imports a lossy WebP and a lossless WebP through the hidden file input
- **THEN** both appear in the gallery filmstrip with preview thumbnails, the gallery count includes both, no import error is shown for those files, and placing one into a frame shows a rendered `spread-frame-image` with non-zero natural width

#### Scenario: Corrupt WebP reports a decode error

- **WHEN** the user imports a truncated or otherwise undecodable WebP file
- **THEN** the system shows a visible per-file import error for that file

#### Scenario: EXIF size-parse failure still yields bitmap dimensions

- **WHEN** the photo worker processes a WebP whose EXIF size parse throws (for example "Unknown file format") but `createImageBitmap` succeeds
- **THEN** the job returns success with width and height taken from the bitmap (or SOF when present)

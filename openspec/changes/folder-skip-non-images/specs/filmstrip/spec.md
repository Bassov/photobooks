## MODIFIED Requirements

### Requirement: Import folder or files into gallery

The system SHALL add a local folder or individual image files to the book gallery. Prefer directory picker when available; provide a file-input path for tests. Accepted types: JPEG, PNG, WebP. Import MUST append without clearing prior entries. Unsupported image-like types in a batch MUST show a per-file error without aborting accepted files. Folder imports MUST skip non-image files without per-file import errors and announce one polite skip summary on editor status. When reading `input.files` then clearing `value`, the handler MUST copy `FileList` to a stable array first.

#### Scenario: Import appends and rejects unsupported

- **WHEN** supported files are imported (including a second batch) or a batch includes TIFF among supported images
- **THEN** supported assets append in order and TIFF shows a visible per-file error without aborting the batch

#### Scenario: Folder skips non-images with status summary

- **WHEN** a folder import includes JPEG files and a README.md
- **THEN** JPEG assets appear in the gallery, import-errors stays empty for the README, and editor-status reports that one non-image file was skipped

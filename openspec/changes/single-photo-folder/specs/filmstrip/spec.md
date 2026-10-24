## MODIFIED Requirements

### Requirement: Import folder or files into gallery

The system SHALL add images from the book's single chosen photo folder to the gallery. Product import is directory-picker only; tests stub that picker. Accepted types: JPEG, PNG, WebP. Choosing a folder for a book that already has a photo folder MUST replace that root after confirm (not accumulate multiple roots). Unsupported image-like types in a batch MUST show a per-file error without aborting accepted files. Folder imports MUST skip non-image files without per-file import errors and announce one polite skip summary on editor status.

#### Scenario: Import from chosen folder

- **WHEN** supported files are imported from the chosen photo folder (including after Change photo folder… replaces the root)
- **THEN** supported assets appear in gallery order for that folder and TIFF among them shows a visible per-file error without aborting the batch

#### Scenario: Folder skips non-images with status summary

- **WHEN** a folder import includes JPEG files and a README.md
- **THEN** JPEG assets appear in the gallery, import-errors stays empty for the README, and editor-status reports that one non-image file was skipped

### Requirement: Thumbnail file names and empty copy

Each thumbnail MUST use the session file name as accessible name when present, else the asset id. Selection/drag identity remains the asset id. Empty gallery MUST show “Choose a photo folder to build the gallery.” with no thumbnails, and empty-state UI MUST span the full filmstrip scrollport width (not a collapsed virtualizer slot).

#### Scenario: Cyrillic name and empty state

- **WHEN** an asset’s session name is `фото отпуск 01.jpg`, or the gallery is empty
- **THEN** the accessible name is that file name, or the full-width empty copy is shown with no thumbnails

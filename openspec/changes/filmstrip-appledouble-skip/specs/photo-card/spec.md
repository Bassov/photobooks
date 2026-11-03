## ADDED Requirements

### Requirement: Hidden and metadata entries are not photos

Any relative path with a segment starting with `.` (macOS AppleDouble `._*`, `.DS_Store`, `.Trashes/`, `.Spotlight-V100/`) MUST NOT become a gallery entry or an import error on any path (folder walk, folder manifest hydrate, file picker, drag-drop); such entries are silent folder skips. On folder rescan, unplaced gallery ids already persisted with such paths MUST be dropped.

#### Scenario: AppleDouble files beside real photos

- **WHEN** a picked folder holds `._X.JPG`, `.DS_Store`, `.Trashes/y.jpg` and real JPEGs, and the book is reloaded twice
- **THEN** only the real JPEGs show as tiles, every tile shows a decoded thumb, and Import errors stays empty

### Requirement: Decode failures survive reload

When an accepted non-HEIC file fails decode on import, the folder manifest MUST remember the failure for that path while its size and mtime are unchanged. On reload the rescan MUST keep that path out of the gallery (no tile, no lazy re-import) and MUST list it once under `decode-failed` Import errors. A size/mtime change or a new folder pick MUST retry the decode.

#### Scenario: Corrupt JPEG after reload

- **WHEN** a folder with a truncated JPEG was imported and the book is reloaded
- **THEN** the filmstrip shows no tile for it and Import errors lists it under Couldn't decode

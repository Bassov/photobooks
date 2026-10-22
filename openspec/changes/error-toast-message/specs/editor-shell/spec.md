## MODIFIED Requirements

### Requirement: Import errors panel

Per-file import failures SHALL carry a stable `id`, a `reason` (`unsupported-type` | `heic` | `decode-failed`), and optional `assetId` when a gallery asset was attempted. Errors from successive imports SHALL append to a session import-errors store (dismiss by id, clear all); a new import MUST NOT wipe unrelated errors. The editor SHALL present errors in a dismissable panel (not as an alert list), openable from the import-error toast action "Show files" and from the filmstrip status when errors remain. Entries SHALL group by reason with counts and file names; each entry has a labelled dismiss control; the panel offers Clear all. The import-error toast description MUST list each failed file with that file’s own message (not a single shared message from the first failure); when a file’s message is empty, the toast MAY list the file name alone. New errors SHALL be announced once via polite Status. Focus SHALL return to the opening control when the panel closes. When a gallery placeholder was enqueued for an asset whose decode later fails, the system MUST remove that placeholder from the gallery so no blank tile remains to select or place; the error entry MAY keep `assetId` for panel grouping but MUST treat the asset as not imported. Folder-import skips of non-image files MUST NOT create import-errors entries; those skips SHALL use a separate polite editor-status summary only.

#### Scenario: Group, dismiss, clear, and not-imported decode

- **WHEN** the user imports a batch that yields unsupported and decode failures, opens the panel from "Show files" or filmstrip status, dismisses one unsupported entry, then clears all
- **THEN** groups show correct reason counts, dismiss and Clear all remove entries from the store, and decode-failed entries whose gallery tile was removed show they were not imported (no jump control)

#### Scenario: Failed decode removes placeholder tile

- **WHEN** an accepted file is enqueued as a filmstrip placeholder and its decode then fails
- **THEN** that placeholder is removed from the gallery, the gallery photo count excludes it, and it cannot be selected or placed

#### Scenario: Folder non-image skips stay out of import-errors

- **WHEN** a folder import skips non-image files and has no per-file import failures
- **THEN** import-errors remains empty and editor-status announces the skipped-file summary

#### Scenario: Toast lists each file with its own message

- **WHEN** a batch yields import failures with different per-file messages (for example HEIC then decode-failed)
- **THEN** the import-error toast description includes each file name with that file’s own message, and MUST NOT reuse the first failure’s message for later files

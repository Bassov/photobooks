## MODIFIED Requirements

### Requirement: Import errors panel

Per-file import failures SHALL carry a stable `id`, a `reason` (`unsupported-type` | `heic` | `decode-failed`), and optional `assetId` when a gallery asset was attempted. Errors from successive imports SHALL append to a session import-errors store (dismiss by id, clear all); a new import MUST NOT wipe unrelated errors. The editor SHALL present errors in a dismissable panel (not as an alert list), openable from the import-error toast action "Show files" and from the filmstrip status when errors remain. Entries SHALL group by reason with counts and file names; each entry has a labelled dismiss control; the panel offers Clear all. New errors SHALL be announced once via polite Status. Focus SHALL return to the opening control when the panel closes. When a gallery placeholder was enqueued for an asset whose decode later fails, the system MUST remove that placeholder from the gallery so no blank tile remains to select or place; the error entry MAY keep `assetId` for panel grouping but MUST treat the asset as not imported.

#### Scenario: Group, dismiss, clear, and jump

- **WHEN** the user imports a batch that yields unsupported and decode failures, opens the panel from "Show files" or filmstrip status, dismisses one entry, then clears all, and activates a linked entry whose `assetId` is still in the gallery
- **THEN** groups show correct reason counts, dismiss and Clear all remove entries from the store, the linked entry scrolls the filmstrip to that tile with selection set, and entries without a gallery tile show they were not imported

#### Scenario: Failed decode removes placeholder tile

- **WHEN** an accepted file is enqueued as a filmstrip placeholder and its decode then fails
- **THEN** that placeholder is removed from the gallery, the gallery photo count excludes it, and it cannot be selected or placed

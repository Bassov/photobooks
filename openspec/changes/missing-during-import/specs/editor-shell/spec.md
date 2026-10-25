## MODIFIED Requirements

### Requirement: Missing-assets relink

The editor SHALL list gallery assets that are `missing` or `modified` relative to a scanned source root and offer Rescan folder (cheap worker scan + pure `matchAssets` on path/size/mtime). Progress MUST be batched per animation frame. Resolve SHALL apply matched identity patches and reattach Files; Skip for now SHALL dismiss the dialog without clearing the pill while problems remain. Metadata mismatch MUST NOT silently substitute a different file. Scrolling during rescan MUST stay inside named scrollports (relink list, filmstrip, pasteboard); no page-level H/V scroll. Per-row Locate… and Use new version are out of scope for this slice. While a photo-folder import (including list-first placeholder enqueue through multi-batch File attach) is in progress for the active book, the editor MUST NOT open the missing-assets dialog or show the missing pill for gallery placeholders that are still awaiting session Files from that import.

#### Scenario: Rescan restores by path metadata

- **WHEN** the user rescans a folder that contains the same relative paths with matching size and mtime and confirms Resolve
- **THEN** matched assets regain live Files and identity paths, and placed frames show the photos again with crops kept

#### Scenario: Skip keeps hatched problems

- **WHEN** the user chooses Skip for now while assets are still missing
- **THEN** the dialog closes and the missing pill remains while the book stays editable

#### Scenario: Active folder import does not open missing UI

- **WHEN** the user imports a photo folder into a book and list-first gallery placeholders exist before every File is attached
- **THEN** the missing-assets dialog and missing pill stay closed for the duration of that import; progress remains on the import bar only

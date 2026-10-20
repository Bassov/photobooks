## MODIFIED Requirements

### Requirement: Save, restore, and hashed previews

Ctrl/Cmd+S (and chrome save) SHALL persist gallery/layout for a library-backed book; typed failures surface as non-blocking status without clearing memory. Reload with granted handle and in-tab active book id SHALL restore that book; without in-tab id, show home; failed restore clears stale state and shows home. After restore/save+reload, thumbnails and placed frames SHALL rehydrate from derived cache when `contentHash` exists (thumb derivative MAY fill a missing zoom tier); landscape crop MUST NOT be square-forced. When gallery assets have durable identity but no live original `File` in session, the editor SHALL surface them via the missing-assets relink flow (pill + dialog) rather than silently treating them as permanently gone.

#### Scenario: Reload restores saved hashed book

- **WHEN** a hashed library-backed book is saved and reloaded with a granted handle and in-tab id
- **THEN** gallery ids, placements, thumbs, and placed frames match the saved durable state

#### Scenario: Missing originals open relink UI

- **WHEN** a restored book has gallery assets with identity/`contentHash` but no live session File for those assets
- **THEN** the missing-assets pill and relink dialog are available and the book stays editable

## ADDED Requirements

### Requirement: Missing-assets relink

The editor SHALL list gallery assets that are `missing` or `modified` relative to a scanned source root and offer Rescan folder (worker scan + worker hash + pure `matchAssets`). Progress MUST be batched per animation frame. Resolve SHALL apply matched identity patches and reattach Files; Skip for now SHALL dismiss the dialog without clearing the pill while problems remain. Hash mismatch MUST NOT silently substitute a different file. Scrolling during rescan MUST stay inside named scrollports (relink list, filmstrip, pasteboard); no page-level H/V scroll. Per-row Locate… and Use new version are out of scope for this slice.

#### Scenario: Rescan restores by content hash

- **WHEN** the user rescans a folder that contains the same bytes under a new path and confirms Resolve
- **THEN** matched assets regain live Files and identity paths, and placed frames show the photos again with crops kept

#### Scenario: Skip keeps hatched problems

- **WHEN** the user chooses Skip for now while assets are still missing
- **THEN** the dialog closes, the missing pill remains, and the book stays editable

#### Scenario: Filmstrip stays responsive during rescan

- **WHEN** a rescan is running and the user scrolls the filmstrip
- **THEN** scrolling occurs only inside the filmstrip scrollport and produces zero LoAF entries for that interaction

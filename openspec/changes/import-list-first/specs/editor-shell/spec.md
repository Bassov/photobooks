## MODIFIED Requirements

### Requirement: Missing-assets relink

The editor SHALL list gallery assets that are `missing` or `modified` relative to a scanned source root and offer Rescan folder (cheap worker scan + pure `matchAssets` on path/size/mtime). Progress MUST be batched per animation frame. Resolve SHALL apply matched identity patches and reattach Files; Skip for now SHALL dismiss the dialog without clearing the pill while problems remain. Metadata mismatch MUST NOT silently substitute a different file. Scrolling during rescan MUST stay inside named scrollports (relink list, filmstrip, pasteboard); no page-level H/V scroll. Per-row Locate… and Use new version are out of scope for this slice.

#### Scenario: Rescan restores by path metadata

- **WHEN** the user rescans a folder that contains the same relative paths with matching size and mtime and confirms Resolve
- **THEN** matched assets regain live Files and identity paths, and placed frames show the photos again with crops kept

#### Scenario: Skip keeps hatched problems

- **WHEN** the user chooses Skip for now while assets are still missing
- **THEN** the dialog closes, the missing pill remains, and the book stays editable

#### Scenario: Filmstrip stays responsive during rescan

- **WHEN** a rescan is running and the user scrolls the filmstrip
- **THEN** scrolling occurs only inside the filmstrip scrollport and produces zero LoAF entries for that interaction

### Requirement: Library-backed import, autosave, and save indicator

Library-backed import MUST register a source root and write identity fields (path/size/mtime); session-only import without a library MAY stay session-only. Dirty library-backed books SHALL autosave after idle debounce (reuse durable save path; MUST NOT start during drag/zoom). During an active photo-folder import, progressive gallery/asset flushes MUST be durable enough that a mid-import reload can restore already-imported gallery ids (and book placements) from library book JSON without waiting for content hashes. The photo-folder handle MUST be remembered in IndexedDB after the first yielded import batch. Chrome SHALL show clean / pending / saving / error indicator without page scroll.

#### Scenario: Idle edit autosaves; gesture waits

- **WHEN** the user edits then idles (no gesture)
- **THEN** storage holds the update; if a gesture spans the debounce, autosave waits until it ends

#### Scenario: Mid-import reload restores partial gallery

- **WHEN** a library-backed folder import has flushed some assets (and optionally placements) and the tab reloads before import finishes
- **THEN** the restored book shows those gallery ids immediately and photo-root restore can continue background import/re-scan

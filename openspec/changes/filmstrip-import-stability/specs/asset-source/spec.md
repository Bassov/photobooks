## MODIFIED Requirements

### Requirement: Prioritized re-scan after reload

When a remembered photo root is restored with `read` permission, the system SHALL verify / re-hash used-in-book files before remaining folder entries. Priority order MUST be: (1) placed assets on the open book’s visible spread, (2) other assets of the open book for that `sourceRootId`, (3) asset refs from other library books matching the same `sourceRootId` and `relativePath`. After known gallery tiles are restored, scanned folder entries whose `relativePath` is not yet in the open book’s gallery MUST continue importing in background batches (yielded, cancellable). Remaining already-imported unused files MAY still be hashed lazily. Size/mtime hash fast path remains in force for unchanged entries.

#### Scenario: Used-in-book files finish before lazy remainder

- **WHEN** a restored root has both placed open-book assets and many unused files
- **THEN** verify/re-hash of the prioritized used-in-book set completes before idle processing of the unused remainder begins

#### Scenario: Visible spread is highest priority

- **WHEN** the open book has placed assets on the visible spread and other placed assets on non-visible spreads
- **THEN** visible-spread placed assets are verified before other open-book assets for that root

#### Scenario: Lazy remainder is cancellable

- **WHEN** idle re-scan of unused files is running and the user changes folder or tears down the session
- **THEN** pending lazy work is cancelled and MUST NOT continue hashing after cancel

#### Scenario: Mid-import reload continues missing gallery entries

- **WHEN** a book was partially imported, persisted with some gallery ids, and reloads with a granted photo root whose scan lists additional image paths not in the gallery
- **THEN** saved gallery tiles (especially book-used) are visible immediately and the missing scanned paths continue importing in the background

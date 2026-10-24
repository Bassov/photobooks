## MODIFIED Requirements

### Requirement: Domain session state API

The system SHALL expose a domain session-state API that remembers and recalls exactly one library directory handle (stable library id), peeks the stored handle without requiring permission, clears the remembered handle, stores and recalls the last active book id (and the single library id), and acquires/releases an exclusive per-book lock. The API MUST NOT list multiple libraries, ordered recents, or remove-recent. The API MUST NOT expose IndexedDB keys, Web Lock names, or raw storage bytes. Directory handles MAY appear only as opaque platform handle values on this API (not on `LibraryStorage`). Callers MUST treat results as typed success or failure codes for the failure modes this capability defines.

#### Scenario: Empty session has no remembered handle

- **WHEN** a new session state is created
- **THEN** recalling the library handle fails with typed code `not-found`

#### Scenario: Remember then recall round-trip

- **WHEN** a library directory handle is remembered and then recalled
- **THEN** the recalled handle refers to the same directory that was stored

#### Scenario: Clear removes the remembered handle

- **WHEN** the remembered library handle is cleared
- **THEN** a subsequent recall fails with typed code `not-found`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory session-state adapter and a browser adapter (IndexedDB for the single library handle and active ids, Web Locks for book locks). Both MUST pass a shared contract-test suite that exercises remember/recall/clear, peek (including not-found and handle available without permission), active id store/recall, reserved-key rejection, single-library migration from legacy recents when present, and lock acquire/release including every typed failure code this capability requires. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code

#### Scenario: Browser adapter passes the contract suite

- **WHEN** the contract suite runs with the browser adapter factory (including test doubles for IndexedDB and Web Locks in non-browser environments)
- **THEN** every case passes without skipping a typed failure code

### Requirement: Active library and book ids in session state

Session state SHALL store and recall the last active library id (the single library) and book id for this browser profile. Clearing the active book id MUST leave the library id unchanged when still set. Missing values MUST be distinguishable from set values without throwing.

#### Scenario: Persist active ids

- **WHEN** the active library id and book id are set and then recalled
- **THEN** the recalled ids match what was stored

#### Scenario: Clear active book only

- **WHEN** an active library id and book id are set and the active book id is cleared
- **THEN** recalling returns the same library id and no book id

### Requirement: Reserved session storage keys

The browser session-state adapter MUST reserve IndexedDB keys used for active ids and any legacy migration markers so they cannot be overwritten as library handle keys. Remembering or clearing a library handle MUST reject reserved keys with a typed failure and MUST NOT overwrite those records. After migration, the adapter MUST NOT maintain an ordered `__recents` list as product state.

#### Scenario: Remember rejects reserved key

- **WHEN** `rememberLibraryHandle` is called with a reserved session key
- **THEN** the call fails with a typed failure and the reserved record is unchanged

## ADDED Requirements

### Requirement: Single library handle and legacy recents migration

Session state SHALL remember at most one library directory handle plus an optional display label (folder name). Replacing the handle (change library) MUST overwrite the previous handle. When opening an existing IndexedDB that still has a legacy ordered `__recents` list, the browser adapter MUST adopt the most recent entry’s handle as the single library, drop other remembered handles and the recents list, and keep a usable active book id when still valid for that library.

#### Scenario: Change library replaces the handle

- **WHEN** a library handle is already remembered and a different directory handle is remembered successfully
- **THEN** recall returns the new handle and the previous handle is no longer stored

#### Scenario: Legacy recents migrate to the most recent

- **WHEN** IndexedDB contains a legacy `__recents` list with multiple entries and matching handles
- **THEN** after open, recall returns the most recent entry’s handle and listing multiple recents is not part of the API

### Requirement: Library folder label

Session state SHALL expose the remembered library’s display label (the directory handle’s folder name when known) for UI that shows the current library “path”. Missing label MUST be distinguishable without throwing.

#### Scenario: Label round-trip

- **WHEN** a library handle is remembered with label `Trip`
- **THEN** callers can read label `Trip` while the handle remains stored

## REMOVED Requirements

### Requirement: Ordered recent libraries

### Requirement: Remove a recent library

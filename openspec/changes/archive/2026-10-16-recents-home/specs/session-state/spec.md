# Spec Delta

## ADDED Requirements

### Requirement: Ordered recent libraries

Session state SHALL maintain an ordered list of recent libraries. Each entry MUST include a stable library id and a display label. Creating or opening a library MUST move that library to the front of the list (or insert it there). Listing recents MUST NOT expose IndexedDB keys, raw storage bytes, or directory handles — only ids and labels. Clearing a library handle MUST remove that library from the recent list.

#### Scenario: Empty session has no recents

- **WHEN** a new session state is created
- **THEN** listing recent libraries returns an empty list

#### Scenario: Remember updates recents order

- **WHEN** library handles are remembered for ids `a` then `b`
- **THEN** listing recent libraries returns `b` before `a`, each with a non-empty display label

#### Scenario: Re-remember moves library to front

- **WHEN** libraries `a` and `b` are already recent and library `a` is remembered again
- **THEN** listing recent libraries returns `a` before `b`

#### Scenario: Clear removes from recents

- **WHEN** a remembered library is cleared
- **THEN** that library id is absent from the recent list

### Requirement: Active library and book ids in session state

Session state SHALL store and recall the last active library id and book id for this browser profile. Clearing the active book id MUST leave the active library id unchanged when still set. Missing values MUST be distinguishable from set values without throwing.

#### Scenario: Persist active ids

- **WHEN** the active library id and book id are set and then recalled
- **THEN** the recalled ids match what was stored

#### Scenario: Clear active book only

- **WHEN** an active library id and book id are set and the active book id is cleared
- **THEN** recalling returns the same library id and no book id

## MODIFIED Requirements

### Requirement: Domain session state API

The system SHALL expose a domain session-state API that remembers and recalls a library directory handle by a stable library id, clears a remembered handle, lists recent libraries, stores and recalls the last active library and book ids, and acquires/releases an exclusive per-book lock. The API MUST NOT expose IndexedDB keys, Web Lock names, or raw storage bytes. Directory handles MAY appear only as opaque platform handle values on this API (not on `LibraryStorage`).

#### Scenario: Empty session has no remembered handle

- **WHEN** a new session state is created
- **THEN** recalling any library id fails with typed code `not-found`

#### Scenario: Remember then recall round-trip

- **WHEN** a library directory handle is remembered under a library id and then recalled
- **THEN** the recalled handle refers to the same directory that was stored

#### Scenario: Clear removes the remembered handle

- **WHEN** a remembered library handle is cleared for that library id
- **THEN** a subsequent recall for that id fails with typed code `not-found`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory session-state adapter and a browser adapter (IndexedDB for handles and recent/active ids, Web Locks for book locks). Both MUST pass a shared contract-test suite that exercises remember/recall/clear, recent-library listing and ordering, active id store/recall, and lock acquire/release including every typed failure code this capability requires. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code

#### Scenario: Browser adapter passes the contract suite

- **WHEN** the contract suite runs with the browser adapter factory (including test doubles for IndexedDB and Web Locks in non-browser environments)
- **THEN** every case passes without skipping a typed failure code

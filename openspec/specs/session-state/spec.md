# session-state Specification

## Purpose

Defines disposable per-browser session state: remembering library directory handles across reloads and enforcing a single exclusive writer per book via locks, with typed results shared by memory and browser adapters.

## Requirements

### Requirement: Domain session state API

The system SHALL expose a domain session-state API that remembers and recalls a library directory handle by a stable library id, peeks a stored handle without requiring permission, clears a remembered handle, lists recent libraries, removes a recent by id, stores and recalls the last active library and book ids, and acquires/releases an exclusive per-book lock. The API MUST NOT expose IndexedDB keys, Web Lock names, or raw storage bytes. Directory handles MAY appear only as opaque platform handle values on this API (not on `LibraryStorage`). Callers MUST treat results as typed success or failure codes for the failure modes this capability defines. Hardening every IndexedDB fault into a typed no-throw path is deferred to `recents-idb-dedup`.

#### Scenario: Empty session has no remembered handle

- **WHEN** a new session state is created
- **THEN** recalling any library id fails with typed code `not-found`

#### Scenario: Remember then recall round-trip

- **WHEN** a library directory handle is remembered under a library id and then recalled
- **THEN** the recalled handle refers to the same directory that was stored

#### Scenario: Clear removes the remembered handle

- **WHEN** a remembered library handle is cleared for that library id
- **THEN** a subsequent recall for that id fails with typed code `not-found`

### Requirement: Exclusive per-book lock

Session state SHALL provide exclusive lock acquire and release for a book id. A successful acquire MUST keep the lock held until release. Trying to acquire while another holder already has the lock MUST fail with typed code `locked-elsewhere` without waiting indefinitely.

#### Scenario: Acquire then release allows a second acquire

- **WHEN** a caller acquires a lock for a book id and then releases it
- **THEN** another acquire for the same book id succeeds

#### Scenario: Concurrent hold is locked-elsewhere

- **WHEN** one caller holds a lock for a book id
- **THEN** a second acquire for that book id fails with typed code `locked-elsewhere`

### Requirement: Typed session results

Session-state operations SHALL return typed success or failure results. Failure codes used by this capability MUST include at least `not-found`, `locked-elsewhere`, and `permission-required`. Callers MUST be able to distinguish these codes without inspecting thrown platform errors.

#### Scenario: Missing handle is not-found

- **WHEN** a caller recalls or clears a library id that has no remembered handle
- **THEN** the result is a typed failure with code `not-found`

#### Scenario: Permission required when handle access is denied

- **WHEN** the browser adapter detects that a remembered directory handle cannot be used without permission
- **THEN** recall fails with typed code `permission-required`

### Requirement: Shared contract suite and adapters

The system SHALL provide an in-memory session-state adapter and a browser adapter (IndexedDB for handles and recent/active ids, Web Locks for book locks). Both MUST pass a shared contract-test suite that exercises remember/recall/clear, peek (including not-found and handle available without permission), recent-library listing and ordering, remove-recent, active id store/recall, reserved-key rejection, and lock acquire/release including every typed failure code this capability requires. The suite MUST accept an adapter factory so both adapters reuse the same cases.

#### Scenario: Memory adapter passes the contract suite

- **WHEN** the contract suite runs with the memory adapter factory
- **THEN** every case passes without skipping a typed failure code

#### Scenario: Browser adapter passes the contract suite

- **WHEN** the contract suite runs with the browser adapter factory (including test doubles for IndexedDB and Web Locks in non-browser environments)
- **THEN** every case passes without skipping a typed failure code

### Requirement: Project module boundary

Session-state code SHALL live under `src/project` and MUST NOT import React or DOM UI modules. Dependency cruiser SHALL keep `src/core` from importing `src/project`.

#### Scenario: Core stays independent of project

- **WHEN** dependency cruiser runs
- **THEN** no `src/core` module depends on `src/project`

### Requirement: Ordered recent libraries

Session state SHALL maintain an ordered list of recent libraries capped at 10 entries. Each entry MUST include a stable library id and a display label. Successfully creating or opening a library MUST move that library to the front of the list (or insert it there). A failed open MUST NOT reorder the list. Listing recents MUST NOT expose IndexedDB keys, raw storage bytes, or directory handles — only ids and labels. Clearing a library handle MUST remove that library from the recent list. The browser adapter SHOULD batch handle and recents writes when practical (strict single-transaction atomicity is deferred to `recents-idb-dedup`).

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

#### Scenario: Cap drops oldest recent

- **WHEN** more than 10 distinct libraries are remembered in succession
- **THEN** listing recent libraries returns at most 10 entries and the oldest entry is absent

### Requirement: Active library and book ids in session state

Session state SHALL store and recall the last active library id and book id for this browser profile. Clearing the active book id MUST leave the active library id unchanged when still set. Missing values MUST be distinguishable from set values without throwing.

#### Scenario: Persist active ids

- **WHEN** the active library id and book id are set and then recalled
- **THEN** the recalled ids match what was stored

#### Scenario: Clear active book only

- **WHEN** an active library id and book id are set and the active book id is cleared
- **THEN** recalling returns the same library id and no book id

### Requirement: Reserved session storage keys

The browser session-state adapter MUST reserve IndexedDB keys `__recents` and `__active` for ordered recents and active ids. Remembering or clearing a library handle MUST reject reserved keys with a typed failure and MUST NOT overwrite those records.

#### Scenario: Remember rejects reserved key

- **WHEN** `rememberLibraryHandle` is called with library id `__recents` or `__active`
- **THEN** the call fails with a typed failure and the reserved record is unchanged

#### Scenario: Clear rejects reserved key

- **WHEN** `clearLibraryHandle` is called with library id `__recents` or `__active`
- **THEN** the call fails with a typed failure and the reserved record is unchanged

### Requirement: Remove a recent library

Session state MUST support removing a recent library by id: clear its remembered handle and drop it from the ordered list.

#### Scenario: Remove recent by id

- **WHEN** the caller removes a recent library by id
- **THEN** that id is absent from the recent list and recalling its handle fails with `not-found`

### Requirement: Peek stored library handle without permission

Session state MUST expose a peek of a remembered library directory handle that returns the opaque stored handle without requiring readwrite permission. Peek MUST still fail with `not-found` when no handle is stored. Callers MUST use peek only for identity comparisons such as `isSameEntry`; open and list paths MUST keep using permission-gated recall.

#### Scenario: Peek returns handle when permission is not granted

- **WHEN** a library handle is remembered and readwrite permission is not granted
- **THEN** peek succeeds with that opaque handle while recall fails with `permission-required`

#### Scenario: Peek missing is not-found

- **WHEN** no handle is stored for a library id
- **THEN** peek fails with typed code `not-found`

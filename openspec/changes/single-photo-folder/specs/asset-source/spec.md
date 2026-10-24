## ADDED Requirements

### Requirement: Persist photo source-root handles outside the domain API

The system SHALL persist File System Access directory handles for photo source roots in IndexedDB, keyed by `sourceRootId`, in a store separate from library handles. The domain asset-source API MUST remain handle-free: session/editor code remembers and recalls handles, then registers an FSA adapter root for scanning and `getFile` by relative path. Permission checks for photo roots MUST use `mode: 'read'` (`queryPermission` / `requestPermission`). Clearing site data or a missing folder MUST surface as typed `not-found` / `permission-required` for callers.

#### Scenario: Remembered root survives reload when granted

- **WHEN** a photo-folder handle was stored for a `sourceRootId` and later recalled with `read` permission granted
- **THEN** the FSA adapter can scan and resolve entries for that root without a new directory picker

#### Scenario: Domain API stays handle-free

- **WHEN** a caller uses only the domain asset-source API after a photo root is registered from a recalled handle
- **THEN** no method parameter or return value is a File System Access directory or file handle

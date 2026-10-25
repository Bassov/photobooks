## MODIFIED Requirements

### Requirement: JPEG head pass for dims and EXIF thumb

After list-first gallery enqueue for JPEG sources, the system SHALL read a bounded file head (≤64 KiB) with capped parallelism (same order as import body-read cap, with yields) to (1) publish an IFD1 embedded thumbnail as a temporary filmstrip thumb until thumb320 replaces it, and (2) obtain width/height/orientation from JPEG SOF/EXIF, apply them to session aspect, and persist them into the folder manifest. Absent or corrupt embedded thumbs MUST leave the placeholder and MUST NOT crash. The head pass MUST NOT require a full-file decode. Assets that already have real dimensions or a hot DerivedCache/thumb320 MAY skip redundant head work. Full-body decode for off-now JPEG MUST wait until the asset enters visible ∪ book-used (same lazy policy as HEIC).

#### Scenario: Embedded EXIF thumb paints before thumb320

- **WHEN** a first-import JPEG exposes an IFD1 embedded thumbnail and thumb320 is not ready
- **THEN** the filmstrip may show that embedded thumbnail until thumb320 publishes

#### Scenario: Missing or corrupt EXIF thumb stays grey

- **WHEN** a JPEG head pass finds no usable IFD1 thumbnail
- **THEN** the tile keeps the ordinary placeholder until thumb320 or later upgrade

#### Scenario: Head dims update aspect without full decode

- **WHEN** a JPEG head yields SOF/EXIF width, height, and orientation before full decode
- **THEN** session aspect / manifest dims update without awaiting createImageBitmap

#### Scenario: Off-now JPEG skips full body decode

- **WHEN** a JPEG gallery asset is outside visible ∪ book-used after list-first enqueue
- **THEN** the system does not full-decode that file until it enters that set

## ADDED Requirements

### Requirement: Import decode reuses one body read for library seed

When a full original body is read for import decode/encode, the system MUST reuse those bytes (or an equivalent single read) for library `seedAndHashEntry` and MUST NOT perform a second full-file `arrayBuffer` on the happy path for that asset. Deferred lazy assets MAY skip body read entirely until decode runs.

#### Scenario: Seed uses preloaded bytes

- **WHEN** import decode has already obtained the file body for an asset that needs library seed
- **THEN** seed uses those bytes without a second full-file body read

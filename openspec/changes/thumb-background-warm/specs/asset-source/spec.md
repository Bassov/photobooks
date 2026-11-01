## MODIFIED Requirements

### Requirement: JPEG head pass for dims and EXIF thumb

After list-first gallery enqueue for JPEG sources, the system SHALL read a bounded file head (≤64 KiB) with capped parallelism (same order as import body-read cap, with yields) to (1) publish an IFD1 embedded thumbnail as a temporary filmstrip thumb until thumb320 replaces it, and (2) obtain width/height/orientation from JPEG SOF/EXIF for session aspect and the folder manifest. Absent/corrupt thumbs MUST leave the placeholder. The head pass MUST NOT require a full-file decode; assets with real dims or hot thumb320 MAY skip it. During import, full-body decode for off-now JPEG waits until visible ∪ book-used (same lazy policy as HEIC); after import the idle background warm lane MAY decode it for thumb320.

#### Scenario: Embedded EXIF thumb or grey placeholder before thumb320

- **WHEN** a first-import JPEG has (or lacks) a usable IFD1 thumbnail and thumb320 is not ready
- **THEN** the filmstrip shows that embedded thumb or the ordinary placeholder until thumb320 publishes

#### Scenario: Head dims and off-now lazy decode

- **WHEN** a JPEG head yields SOF/EXIF dims, or a gallery JPEG stays outside visible ∪ book-used while import runs
- **THEN** aspect/manifest update without createImageBitmap, and full decode waits until the asset enters that set or the import ends and the warm lane reaches it

## MODIFIED Requirements

### Requirement: Placeholders, thumbnails, and aspect slots

The filmstrip SHALL list gallery assets horizontally with virtualization. Each item sizes its slot from clamped aspect (fixed height) when aspect is known; list-first entries MAY use a simple default aspect placeholder until dimensions are known. New assets show a name/size (or aspect) placeholder before an orientation-corrected thumbnail. When a JPEG head pass finds an IFD1 embedded thumbnail, the filmstrip MAY show that embedded image as a temporary tile until the orientation-corrected thumb320 replaces it; missing/corrupt embedded thumbs keep the ordinary placeholder. Object URLs stay in a bounded cache and are revoked on eviction. After a cheap folder scan, the system MUST enqueue gallery placeholders for scanned image entries before body reads / thumb320 decode; newly enqueued ids MUST appear progressively (paced for frame-budget gates); the system MAY reserve scroll extent via a progress spacer. When a persisted folder manifest is available on restore, the system MUST enqueue gallery entries from that manifest (using stored width/height/orientation for aspects when present) before the folder walk completes so slots can paint immediately. Styling stays deliberately simple (existing primitives; no new visual system).

#### Scenario: Placeholder then distinct aspect thumbs

- **WHEN** portrait and landscape assets enter the gallery
- **THEN** placeholders appear before thumbs, portrait slots are narrower than landscape at the same height once aspect is known, and thumbs show the full photo

#### Scenario: List-first placeholders before body reads

- **WHEN** a photo-folder scan returns many image entries and body reads or thumb320 decode have not finished
- **THEN** the filmstrip shows placeholders for those entries (usable name from relative path) without waiting for file bodies

#### Scenario: Manifest-first slots before scan resolves

- **WHEN** a book reloads with a granted photo root and a valid folder manifest that includes dimensions for gallery entries
- **THEN** filmstrip aspect slots reflect those dimensions before `scanRoot` completes

#### Scenario: EXIF embedded thumb before thumb320

- **WHEN** a first-import JPEG exposes an IFD1 embedded thumbnail and thumb320 is not ready
- **THEN** the tile may show that embedded thumbnail until thumb320 publishes

### Requirement: Visible-window decode priority

Decode and thumbnail work for assets in the mounted filmstrip window and for book-used assets MUST outrank idle off-window gallery work. Changing the visible window MUST update the visible-asset set used by the worker queue so newly visible tiles are preferred without aborting an in-flight import batch. Entries outside visible ∪ book-used MAY remain placeholders until scrolled into view or used in the book. HEIC/HEIF assets MUST NOT be queued for prefetch or background thumb320 work while outside visible ∪ book-used; when such an asset enters that set, decode MUST be queued at visible priority.

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred by the decode queue over off-window idle ids

#### Scenario: Book-used outranks idle placeholders

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used ids are preferred over idle unused placeholders

#### Scenario: Off-screen HEIC stays unqueued

- **WHEN** a HEIC/HEIF gallery asset is neither in the mounted filmstrip window nor book-used
- **THEN** the decode pool does not queue prefetch/background work for that asset

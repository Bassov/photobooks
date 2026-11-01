## MODIFIED Requirements

### Requirement: Placeholders, thumbnails, and aspect slots

The filmstrip SHALL list gallery assets horizontally with virtualization. Each item sizes its slot from clamped aspect (fixed height) when aspect is known; list-first entries MAY use a simple default aspect placeholder until dimensions are known. New assets show a name/size (or aspect) placeholder before an orientation-corrected thumbnail. When a JPEG head pass finds an IFD1 embedded thumbnail, the filmstrip MAY show that embedded image as a temporary tile until the orientation-corrected thumb320 replaces it; missing/corrupt embedded thumbs keep the ordinary placeholder. Thumb object URLs MUST be bounded by a byte budget (least recently used, unmounted entries evicted past it) and revoked on eviction, asset removal, replacement or reset. A tile whose thumb bytes are cached in this session MUST render the thumb on remount, with no placeholder. After a cheap folder scan, the system MUST enqueue gallery placeholders for scanned image entries before body reads / thumb320 decode; newly enqueued ids MUST appear progressively (paced for frame-budget gates); the system MAY reserve scroll extent via a progress spacer. When a persisted folder manifest is available on restore, the system MUST enqueue gallery entries from that manifest (using stored width/height/orientation for aspects when present) before the folder walk completes so slots can paint immediately. Styling stays deliberately simple (existing primitives; no new visual system).

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

#### Scenario: Seen thumbs stay hot on fast scroll

- **WHEN** every thumb of a 400+ photo gallery has loaded and the user flings the strip end → start → end
- **THEN** no frame shows a placeholder inside the scrollport

### Requirement: Progressive reveal and import pacing

Progressive reveal MUST NOT lag `scrollLeft` into a mid-scroll dead zone of unrevealed in-range content. Mid-import mounts MUST stay within frame-budget gates without freezing the gallery id list solely to pass LoAF. Thumb publishes MUST notify only mounted tiles, scrollport tiles first, within a per-frame budget; during the scroll-quiet window, scrollport tiles still publish. Once a gallery id has been flushed into the filmstrip, scrolling during continued import MUST NOT permanently drop that tile from the gallery or leave it unrestorable when it re-enters the virtual window (in-session thumb bytes stay cached within the byte budget; past it, DerivedCache or decode restores the thumb).

#### Scenario: Mid-scroll reveal and mid-import scroll

- **WHEN** the user scrolls during or after progressive import with more items remaining
- **THEN** in-range content is revealed without a large dead zone, and newly enqueued ids continue to appear under frame-budget pacing

#### Scenario: Revealed tiles survive scroll during import

- **WHEN** assets have been flushed into the gallery and shown in the filmstrip window, then the user scrolls away and back while import is still running
- **THEN** those asset ids remain in the gallery and their tiles remount with a thumb or placeholder that recovers (not a permanent hole)

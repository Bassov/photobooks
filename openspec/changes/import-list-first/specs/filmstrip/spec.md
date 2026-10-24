## MODIFIED Requirements

### Requirement: Placeholders, thumbnails, and aspect slots

The filmstrip SHALL list gallery assets horizontally with virtualization. Each item sizes its slot from clamped aspect (fixed height) when aspect is known; list-first entries MAY use a simple default aspect placeholder until decode supplies dimensions. New assets show a name/size (or aspect) placeholder before an orientation-corrected full-photo thumbnail (async decode, no default cover crop). Object URLs stay in a bounded cache and are revoked on eviction. After a cheap folder scan, the system MUST enqueue gallery placeholders for scanned image entries before body reads / thumb320 decode; newly enqueued ids MUST appear progressively (paced for frame-budget gates); the system MAY reserve scroll extent via a progress spacer. Styling stays deliberately simple (existing primitives; no new visual system).

#### Scenario: Placeholder then distinct aspect thumbs

- **WHEN** portrait and landscape assets enter the gallery
- **THEN** placeholders appear before thumbs, portrait slots are narrower than landscape at the same height once aspect is known, and thumbs show the full photo

#### Scenario: List-first placeholders before body reads

- **WHEN** a photo-folder scan returns many image entries and body reads or thumb320 decode have not finished
- **THEN** the filmstrip shows placeholders for those entries (usable name from relative path) without waiting for file bodies

### Requirement: Visible filmstrip tiles prioritize decode

Decode and thumbnail work for assets in the mounted filmstrip window and for book-used assets MUST outrank idle off-window gallery work. Changing the visible window MUST update the visible-asset set used by the worker queue so newly visible tiles are preferred without aborting an in-flight import batch. Entries outside visible ∪ book-used MAY remain placeholders until scrolled into view or used in the book.

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred by the decode queue over off-window idle ids

#### Scenario: Book-used outranks idle unused

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used decode is preferred before idle unused placeholders

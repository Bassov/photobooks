# filmstrip Specification

## Purpose

Book-gallery filmstrip: import, progressive reveal, virtualized variable-width packing, thumbnails (derived cache), status strip, and filmstrip scrollport containment. Shell/home/library lifecycle lives in `editor-shell`; pasteboard place/camera/template in `pasteboard`.

## Requirements

### Requirement: Import folder or files into gallery

The system SHALL add images from the book's single chosen photo folder to the gallery. Product import is directory-picker only; tests stub that picker. Accepted types: JPEG, PNG, WebP. Choosing a folder for a book that already has a photo folder MUST replace that root after confirm (not accumulate multiple roots). Unsupported image-like types in a batch MUST show a per-file error without aborting accepted files. Folder imports MUST skip non-image files without per-file import errors and announce one polite skip summary on editor status.

#### Scenario: Import from chosen folder

- **WHEN** supported files are imported from the chosen photo folder (including after Change photo folder… replaces the root)
- **THEN** supported assets appear in gallery order for that folder and TIFF among them shows a visible per-file error without aborting the batch

#### Scenario: Folder skips non-images with status summary

- **WHEN** a folder import includes JPEG files and a README.md
- **THEN** JPEG assets appear in the gallery, import-errors stays empty for the README, and editor-status reports that one non-image file was skipped

### Requirement: Placeholders, thumbnails, and aspect slots

The filmstrip SHALL list gallery assets horizontally with virtualization. Each item sizes its slot from clamped aspect (fixed height) when aspect is known; list-first entries MAY use a simple default aspect placeholder until dimensions are known. New assets show a name/size (or aspect) placeholder before an orientation-corrected full-photo thumbnail (async decode, no default cover crop). Object URLs stay in a bounded cache and are revoked on eviction. After a cheap folder scan, the system MUST enqueue gallery placeholders for scanned image entries before body reads / thumb320 decode; newly enqueued ids MUST appear progressively (paced for frame-budget gates); the system MAY reserve scroll extent via a progress spacer. When a persisted folder manifest is available on restore, the system MUST enqueue gallery entries from that manifest (using stored width/height/orientation for aspects when present) before the folder walk completes so slots can paint immediately. Styling stays deliberately simple (existing primitives; no new visual system).

#### Scenario: Placeholder then distinct aspect thumbs

- **WHEN** portrait and landscape assets enter the gallery
- **THEN** placeholders appear before thumbs, portrait slots are narrower than landscape at the same height once aspect is known, and thumbs show the full photo

#### Scenario: List-first placeholders before body reads

- **WHEN** a photo-folder scan returns many image entries and body reads or thumb320 decode have not finished
- **THEN** the filmstrip shows placeholders for those entries (usable name from relative path) without waiting for file bodies

#### Scenario: Manifest-first slots before scan resolves

- **WHEN** a book reloads with a granted photo root and a valid folder manifest that includes dimensions for gallery entries
- **THEN** filmstrip aspect slots reflect those dimensions before `scanRoot` completes

### Requirement: Import progress and status strip

While multi-file import runs, the filmstrip status strip SHALL show progress and remain scrollable. The strip MUST show gallery photo count when non-empty or importing.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress is visible on the status strip and the filmstrip remains scrollable

### Requirement: Filmstrip scrollport containment

When the gallery is longer than the visible filmstrip, horizontal scrolling MUST occur only inside the filmstrip scrollport. The document MUST NOT gain page-level H/V scroll from a long gallery.

#### Scenario: Long gallery scrolls inside the filmstrip

- **WHEN** the gallery contains far more assets than fit on screen
- **THEN** filmstrip `scrollWidth` > `clientWidth`, changing `scrollLeft` scrolls the gallery, and `document.documentElement` scroll size does not exceed client size

### Requirement: Thumbnail file names and empty copy

Each thumbnail MUST use the session file name as accessible name when present, else the asset id. Selection/drag identity remains the asset id. Empty gallery MUST show “Choose a photo folder to build the gallery.” with no thumbnails, and empty-state UI MUST span the full filmstrip scrollport width (not a collapsed virtualizer slot).

#### Scenario: Cyrillic name and empty state

- **WHEN** an asset’s session name is `фото отпуск 01.jpg`, or the gallery is empty
- **THEN** the accessible name is that file name, or the full-width empty copy is shown with no thumbnails

### Requirement: Derived-cache thumbnails

When durable identity (`sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`) is complete, thumbnail bytes SHALL persist under the identity digest and a thumbnail preset id, and hydrate from derived cache before re-encode. Without complete identity, caching stays memory-only (hot object-URL LRU) without fabricating keys; layout/virtualization/naming unchanged. In-session thumb bytes MAY republish after LRU eviction before a durable identity digest is available for DerivedCache.

#### Scenario: Identity hydrate; incomplete identity memory-only

- **WHEN** an identity-complete asset’s hot URL is missing and cache holds the preset — or an identity-incomplete asset produces a thumb
- **THEN** identity thumbs hydrate from cache / are stored after encode, and incomplete-identity thumbs do not write derived-cache keys

### Requirement: Variable-width packing and sliding window

Variable-width packing MUST use absolute offsets from each card’s end plus gap (not a fixed max-width stride). The virtual window MUST cover scrollport width plus overscan using aspect-derived strides so mid-scroll has no portrait-sized holes.

#### Scenario: Mid-scroll window covers the port

- **WHEN** a long mixed-aspect gallery is scrolled mid-way with more items remaining
- **THEN** the mounted window covers the visible scrollport with overscan and positions follow per-card end+gap offsets

### Requirement: Progressive reveal and import pacing

Progressive reveal MUST NOT lag `scrollLeft` into a mid-scroll dead zone of unrevealed in-range content. Mid-import mounts MUST stay within frame-budget gates without freezing the gallery id list solely to pass LoAF. Once a gallery id has been flushed into the filmstrip, scrolling during continued import MUST NOT permanently drop that tile from the gallery or leave it unrestorable when it re-enters the virtual window (in-session thumb bytes MAY republish after LRU eviction before a durable identity digest is available for DerivedCache).

#### Scenario: Mid-scroll reveal and mid-import scroll

- **WHEN** the user scrolls during or after progressive import with more items remaining
- **THEN** in-range content is revealed without a large dead zone, and newly enqueued ids continue to appear under frame-budget pacing

#### Scenario: Revealed tiles survive scroll during import

- **WHEN** assets have been flushed into the gallery and shown in the filmstrip window, then the user scrolls away and back while import is still running
- **THEN** those asset ids remain in the gallery and their tiles remount with a thumb or placeholder that recovers (not a permanent hole)

### Requirement: Visible filmstrip tiles prioritize decode

Decode and thumbnail work for assets in the mounted filmstrip window and for book-used assets MUST outrank idle off-window gallery work. Changing the visible window MUST update the visible-asset set used by the worker queue so newly visible tiles are preferred without aborting an in-flight import batch. Entries outside visible ∪ book-used MAY remain placeholders until scrolled into view or used in the book.

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred by the decode queue over off-window idle ids

#### Scenario: Book-used outranks idle unused

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used decode is preferred before idle unused placeholders

# filmstrip Specification

## Purpose

Book-gallery filmstrip: import, progressive reveal, virtualized variable-width packing, thumbnails (derived cache), status strip, and filmstrip scrollport containment. Shell/home/library lifecycle lives in `editor-shell`; pasteboard place/camera/template in `pasteboard`.

## Requirements

### Requirement: Import folder or files into gallery

The system SHALL add a local folder or individual image files to the book gallery. Prefer directory picker when available; provide a file-input path for tests. Accepted types: JPEG, PNG, WebP. Import MUST append without clearing prior entries. Unsupported types in a batch MUST show a per-file error without aborting accepted files. When reading `input.files` then clearing `value`, the handler MUST copy `FileList` to a stable array first.

#### Scenario: Import appends and rejects unsupported

- **WHEN** supported files are imported (including a second batch) or a batch includes TIFF among supported images
- **THEN** supported assets append in order and TIFF shows a visible per-file error without aborting the batch

### Requirement: Placeholders, thumbnails, and aspect slots

The filmstrip SHALL list gallery assets horizontally with virtualization. Each item sizes its slot from clamped aspect (fixed height). New assets show an aspect-ratio placeholder before an orientation-corrected full-photo thumbnail (async decode, no default cover crop). Object URLs stay in a bounded cache and are revoked on eviction. During multi-file import, newly enqueued ids MUST appear progressively (paced for frame-budget gates); the system MAY reserve scroll extent via a progress spacer.

#### Scenario: Placeholder then distinct aspect thumbs

- **WHEN** portrait and landscape assets enter the gallery
- **THEN** placeholders appear before thumbs, portrait slots are narrower than landscape at the same height, and thumbs show the full photo

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

Each thumbnail MUST use the session file name as accessible name when present, else the asset id. Selection/drag identity remains the asset id. Empty gallery MUST show “Add a folder or photos to build the gallery.” with no thumbnails, and empty-state UI MUST span the full filmstrip scrollport width (not a collapsed virtualizer slot).

#### Scenario: Cyrillic name and empty state

- **WHEN** an asset’s session name is `фото отпуск 01.jpg`, or the gallery is empty
- **THEN** the accessible name is that file name, or the full-width empty copy is shown with no thumbnails

### Requirement: Derived-cache thumbnails

When `contentHash` is known, thumbnail bytes SHALL persist under that hash and a thumbnail preset id, and hydrate from derived cache before re-encode. Without `contentHash`, caching stays memory-only (no fabricated hash keys); layout/virtualization/naming unchanged.

#### Scenario: Hashed hydrate; unhashed memory-only

- **WHEN** a hashed asset’s hot URL is missing and cache holds the preset — or an unhashed asset produces a thumb
- **THEN** hashed thumbs hydrate from cache / are stored after encode, and unhashed thumbs do not write derived-cache keys

### Requirement: Variable-width packing and sliding window

Variable-width packing MUST use absolute offsets from each card’s end plus gap (not a fixed max-width stride). The virtual window MUST cover scrollport width plus overscan using aspect-derived strides so mid-scroll has no portrait-sized holes.

#### Scenario: Mid-scroll window covers the port

- **WHEN** a long mixed-aspect gallery is scrolled mid-way with more items remaining
- **THEN** the mounted window covers the visible scrollport with overscan and positions follow per-card end+gap offsets

### Requirement: Progressive reveal and import pacing

Progressive reveal MUST NOT lag `scrollLeft` into a mid-scroll dead zone of unrevealed in-range content. Mid-import mounts MUST stay within frame-budget gates without freezing the gallery id list solely to pass LoAF.

#### Scenario: Mid-scroll reveal and mid-import scroll

- **WHEN** the user scrolls during or after progressive import with more items remaining
- **THEN** in-range content is revealed without a large dead zone, and newly enqueued ids continue to appear under frame-budget pacing

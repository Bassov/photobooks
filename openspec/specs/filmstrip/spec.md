# filmstrip Specification

## Purpose

Book-gallery filmstrip: import, progressive reveal, virtualized variable-width packing, thumbnails (derived cache), status strip, and filmstrip scrollport containment. Shell/home/library lifecycle lives in `editor-shell`; pasteboard place/camera/template in `pasteboard`.

## Requirements

### Requirement: Import folder or files into gallery

The system SHALL add images from the book's single chosen photo folder to the gallery. Product import is directory-picker only; tests stub that picker. Accepted types: JPEG, PNG, WebP, and HEIC/HEIF (placeholders until visible or book-used). Choosing a folder for a book that already has a photo folder MUST replace that root after confirm (not accumulate multiple roots). Unsupported image-like types in a batch MUST show a per-file error without aborting accepted files. Folder imports MUST skip non-image files without per-file import errors and announce one polite skip summary on editor status.

#### Scenario: Import from chosen folder

- **WHEN** supported files are imported from the chosen photo folder (including after Change photo folder… replaces the root)
- **THEN** supported assets appear in gallery order for that folder and TIFF among them shows a visible per-file error without aborting the batch

#### Scenario: Folder skips non-images with status summary

- **WHEN** a folder import includes JPEG files and a README.md
- **THEN** JPEG assets appear in the gallery, import-errors stays empty for the README, and editor-status reports that one non-image file was skipped

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

### Requirement: Import progress and status strip

While multi-file import runs, the filmstrip status strip SHALL show progress and remain scrollable. The strip MUST show gallery photo count when non-empty or importing. Progress MAY reflect list/enqueue readiness and visible-window decode rather than requiring every gallery original to be fully decoded before import is treated as complete.

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

### Requirement: Visible-window decode priority

Decode and thumbnail work SHALL use two lanes: **now** (mounted filmstrip window ∪ painted-spread ∪ book-used) and **background** (other gallery prefetch). Now MUST always outrank background; background MUST run only in idle time and MUST NOT starve now. Changing the visible window MUST update the now set: assets that leave now with an unfinished thumb/working job MUST have that job aborted (queued dropped; in-flight aborted where possible) and MUST be re-enqueued at now when they re-enter without a hot thumb. The gallery import batch itself MUST continue (list-first placeholders). JPEG and HEIC/HEIF assets MUST NOT be queued for background full-original decode while outside now; when such an asset enters now, decode MUST be queued at now priority ahead of start-ordered off-window work (including when the user scrolls to the filmstrip tail).

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred on the now lane over background ids

#### Scenario: Scroll-out cancels off-window decode

- **WHEN** an asset leaves the now set while its thumb decode is queued or in flight and it is not book-used
- **THEN** that job is aborted and removed from the queue

#### Scenario: Re-enter re-enqueues

- **WHEN** a previously cancelled asset re-enters the now set without a hot thumb
- **THEN** a now-lane encode is queued again

#### Scenario: Book-used outranks idle placeholders

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used ids are preferred over idle unused placeholders

#### Scenario: Off-screen JPEG or HEIC stays unqueued

- **WHEN** a JPEG or HEIC/HEIF asset is outside the now set
- **THEN** no background full-original decode is queued for it

#### Scenario: Tail scroll outranks start-ordered prefetch

- **WHEN** the user scrolls the filmstrip to near the end while earlier off-window assets remain undecoded
- **THEN** decode slots prefer the newly visible tail ids over start-ordered background work

### Requirement: Tone-only filmstrip selection and used badges

Selected filmstrip thumbs SHALL use tone fill `#CACACA` only (no black ring-select, no blue). Keyboard focus MAY show a gray a11y ring. Used/placed badges on thumbs SHALL use black/ink styling (not a blue brand fill). Folder-import and filmstrip folder messages (“no new photos”, loose-file drop hints, skip summaries) MUST go to the editor status line, not toast popups.

#### Scenario: Selected thumb is tone-only

- **WHEN** the user selects a filmstrip photo
- **THEN** the selected thumb shows `#CACACA` background without a black selection ring

#### Scenario: Placed badge is black ink

- **WHEN** a gallery photo is placed on a frame
- **THEN** the filmstrip Placed badge uses black/ink styling

### Requirement: Gallery sort and unplaced filter

The filmstrip dock SHALL offer sort by capture time (asset `capturedAt`, else file mtime, undated last), name, or added order, and an "Unplaced only" filter that hides photos placed on any frame. Sort/filter MUST NOT reorder or mutate the book gallery, MUST update inside a transition, and MUST keep scrolling inside the filmstrip scrollport. An empty filtered view MUST show "All photos are placed."

#### Scenario: Unplaced only shrinks as the book fills

- **WHEN** "Unplaced only" is on and a gallery photo is placed
- **THEN** that photo leaves the list and the dock count reads "N of M"

### Requirement: Remove photo from gallery

The system SHALL remove a gallery photo via × on its thumb or Delete/Backspace on the selected thumb. A placed photo MUST first ask in an AlertDialog and empty its frames on confirm; an unplaced photo is removed immediately with a status-line message. The file on disk MUST NOT be touched.

#### Scenario: Placed photo asks first

- **WHEN** the user removes a placed photo and confirms
- **THEN** it leaves the gallery and its frame is empty

### Requirement: Adjustable filmstrip thumbnail size

The filmstrip dock SHALL let the user change the thumbnail height (64–192 px, default 96) with a top-edge splitter (pointer drag, ↑/↓ keys) or a size slider, and SHALL remember it in the browser. During a drag only CSS variables change; the virtualizer MUST re-lay out once on release, with no gaps in the scrolled strip. Scrolling MUST stay inside the filmstrip scrollport.

#### Scenario: Resize while scrolled mid-gallery

- **WHEN** the user drags the splitter while the strip is scrolled mid-gallery
- **THEN** thumbnails rescale on release and no frame is dropped to LoAF

### Requirement: Desktop folder drop on the filmstrip

A photo folder dropped from the desktop onto the dock SHALL be imported through the same path as "Choose photo folder" (replace confirm when a folder is bound). Loose files MUST NOT be imported and MUST set the status "Drop a folder — Photobooks adds folders, not single photos". Only read-only directory handles are accepted.

#### Scenario: Loose file dropped

- **WHEN** a single photo file is dropped on the dock
- **THEN** nothing is imported and the status explains that folders are required

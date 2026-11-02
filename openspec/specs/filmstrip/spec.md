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

### Requirement: Restore hydrates cached gallery thumbs

On restore with a granted photo root, right after the manifest-first gallery enqueue, the system SHALL read every gallery asset's DerivedCache thumb into the hot thumb cache in the background: at most 24 reads in flight, nearest to the filmstrip window first (while the strip scrolls, ahead of it first), storing in main-thread slices of at most 3 ms (only at frame start while the strip scrolls), stopping at the byte budget without evicting. Tiles mounted later MUST render the hydrated thumb with no placeholder.

#### Scenario: Reset cancels the pass

- **WHEN** the thumb cache resets or an asset is removed while the pass reads it
- **THEN** the cancelled pass or the removed asset stores no thumb

#### Scenario: Fling after reload shows no placeholder

- **WHEN** a book with at least 400 cached gallery thumbs reloads and the background pass has finished
- **THEN** flinging the filmstrip to the end and back shows no placeholder inside the filmstrip scrollport

#### Scenario: Outward from the window

- **WHEN** the filmstrip window shows gallery items in the middle of the list
- **THEN** the pass reads those items first, then alternates outward right and left

#### Scenario: Byte budget stops the pass

- **WHEN** the next cached thumb would push hot bytes past the byte budget
- **THEN** the pass stops without evicting any hot thumb

### Requirement: Variable-width packing and sliding window

Variable-width packing MUST use absolute offsets from each card’s end plus gap (not a fixed max-width stride). The virtual window MUST cover scrollport width plus overscan using aspect-derived strides so mid-scroll has no portrait-sized holes.

#### Scenario: Mid-scroll window covers the port

- **WHEN** a long mixed-aspect gallery is scrolled mid-way with more items remaining
- **THEN** the mounted window covers the visible scrollport with overscan and positions follow per-card end+gap offsets

### Requirement: Progressive reveal and import pacing

Progressive reveal MUST NOT lag `scrollLeft` into a mid-scroll dead zone of unrevealed in-range content. Mid-import mounts MUST stay within frame-budget gates without freezing the gallery id list solely to pass LoAF. Thumb publishes MUST notify only mounted tiles, scrollport tiles first, within a per-frame budget; during the scroll-quiet window, scrollport tiles still publish. Once a gallery id has been flushed into the filmstrip, scrolling during continued import MUST NOT permanently drop that tile from the gallery or leave it unrestorable when it re-enters the virtual window (in-session thumb bytes stay cached within the byte budget; past it, DerivedCache or decode restores the thumb).

#### Scenario: Mid-scroll reveal and mid-import scroll

- **WHEN** the user scrolls during or after progressive import with more items remaining
- **THEN** in-range content is revealed without a large dead zone, and newly enqueued ids continue to appear under frame-budget pacing

#### Scenario: Revealed tiles survive scroll during import

- **WHEN** assets have been flushed into the gallery and shown in the filmstrip window, then the user scrolls away and back while import is still running
- **THEN** those asset ids remain in the gallery and their tiles remount with a thumb or placeholder that recovers (not a permanent hole)

### Requirement: Visible-window decode priority

Decode and thumbnail work SHALL use two lanes: **now** (mounted filmstrip window ∪ painted-spread ∪ book-used) and **background** (other gallery prefetch). Now MUST always outrank background; background MUST run only in idle time and MUST NOT starve now. Changing the visible window MUST update the now set: when an asset leaves now, its queued thumb/working jobs MUST be dropped, an in-flight working-preview (1280) job MUST be aborted, and an in-flight thumb320 job MUST run to completion with its result published and stored. A dropped or aborted asset MUST be re-enqueued at now when it re-enters without a hot thumb. A decode slot whose job was aborted MUST stay busy until its worker replies for that request, so no job is ever posted to a worker that is still decoding. The gallery import batch itself MUST continue (list-first placeholders). While the filmstrip scrolls, the now set MUST update at most every ~100 ms (not only after scroll-quiet), with the window extended in the scroll direction by the current velocity; the exact window is published once scrolling stops. After import, a background warm lane SHALL encode thumb320 (JPEG and HEIC/HEIF included) for every identity-complete gallery asset without a stored thumb, ordered book-used first, then by distance from the filmstrip window with the scroll direction first; it runs only in idle, with one slot while the filmstrip scrolls or a canvas gesture is active and the idle cap (with longtask / memory backoff) otherwise. A failed encode (e.g. unsupported HEIC) MUST NOT be retried by the lane. When a JPEG or HEIC/HEIF asset enters now, decode MUST be queued at now priority ahead of off-window work (including when the user scrolls to the filmstrip tail).

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred on the now lane over background ids

#### Scenario: Scroll-out drops queued decode

- **WHEN** an asset leaves the now set while its thumb decode is queued and it is not book-used
- **THEN** that job is aborted and removed from the queue

#### Scenario: Scroll-out keeps an in-flight thumb

- **WHEN** an asset leaves the now set while its thumb320 decode is already running on a worker
- **THEN** that decode finishes and its thumb is published and stored

#### Scenario: Aborted slot waits for the worker

- **WHEN** an in-flight decode is aborted
- **THEN** its slot takes no new job until the worker replies for the aborted request

#### Scenario: Re-enter re-enqueues

- **WHEN** a previously cancelled asset re-enters the now set without a hot thumb
- **THEN** a now-lane encode is queued again

#### Scenario: Book-used outranks idle placeholders

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used ids are preferred over idle unused placeholders

#### Scenario: Idle folder warms every thumb

- **WHEN** a folder of JPEGs is imported and the filmstrip is left untouched
- **THEN** every JPEG gets a thumb320 stored in DerivedCache, and an unsupported HEIC keeps its placeholder without retries

#### Scenario: Now set follows a running scroll

- **WHEN** the filmstrip keeps scrolling longer than the throttle interval
- **THEN** the now set is updated before scrolling stops, extended ahead in the scroll direction

#### Scenario: Tail scroll outranks start-ordered prefetch

- **WHEN** the user scrolls the filmstrip to near the end while earlier off-window assets remain undecoded
- **THEN** decode slots prefer the newly visible tail ids over start-ordered background work

### Requirement: Tone-only filmstrip selection and used badges

Selected filmstrip thumbs SHALL use tone fill `#CACACA` only (no black ring-select, no blue). Keyboard focus MAY show a gray a11y ring. Used/placed photos SHALL show a corner check (black/55 disc, white check; no pill, no green, no blue). The dock bar is `#E1E1E1` with a plain head “Photos · {gallery} · {used} used” and quiet ghost sort/filter chips. Folder-import and filmstrip folder messages (“no new photos”, loose-file drop hints, skip summaries) MUST go to the editor status line, not toast popups.

#### Scenario: Selected thumb is tone-only

- **WHEN** the user selects a filmstrip photo
- **THEN** the selected thumb shows `#CACACA` background without a black selection ring

#### Scenario: Used mark is a corner check

- **WHEN** a gallery photo is placed on a frame
- **THEN** its thumb shows a corner check and the dock head counts it as used

### Requirement: Gallery sort and unplaced filter

The filmstrip dock SHALL offer sort by capture time (asset `capturedAt`, else file mtime, undated last), name, or added order, and an "Unplaced only" filter that hides photos placed on any frame. Sort/filter MUST NOT reorder or mutate the book gallery, MUST update inside a transition, and MUST keep scrolling inside the filmstrip scrollport. An empty filtered view MUST show "All photos are placed."

#### Scenario: Unplaced only shrinks as the book fills

- **WHEN** "Unplaced only" is on and a gallery photo is placed
- **THEN** that photo leaves the list and the dock count reads "N of M · U used"

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

### Requirement: Multi-select photos

The filmstrip SHALL support Shift+click range, Ctrl/Cmd+click toggle, Ctrl/Cmd+A select-all and Esc clear; dragging a selected photo SHALL carry the whole selection in gallery order.

#### Scenario: Range select

- **WHEN** the user clicks photo 1 then Shift+clicks photo 4
- **THEN** photos 1–4 are selected

#### Scenario: Toggle and clear

- **WHEN** the user Ctrl+clicks a selected photo, then presses Esc
- **THEN** it is deselected, then all are cleared

#### Scenario: Drag carries selection

- **WHEN** a selected photo is dragged
- **THEN** all selected photos travel in gallery order

### Requirement: Mouse wheel scrolls the filmstrip sideways

A wheel over the filmstrip SHALL scroll it horizontally (the dominant wheel delta maps to `scrollLeft`) and SHALL NOT scroll the page or change the canvas zoom.

#### Scenario: Vertical wheel over the strip

- **WHEN** the user wheels down over the filmstrip
- **THEN** the strip's `scrollLeft` grows, and the canvas zoom and window scroll are unchanged

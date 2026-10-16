# editor-shell Specification

## Purpose

Editor chrome that presents a workspace above a book-gallery filmstrip, and lets the user import local folders or files into that gallery with visible progress.

## Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip. The shell MUST replace the previous single photo-card screen as the primary app surface.

#### Scenario: Shell visible on load

- **WHEN** the user opens the app
- **THEN** a workspace region and a filmstrip region are visible, and the legacy single photo-card success screen is not the primary layout

### Requirement: Import folder or files into gallery

The system SHALL let the user add a local folder or individual image files to the book gallery. When a directory picker is available, the system MUST prefer it for folder import and MUST also provide a file-input path suitable for automated tests (including directory selection where the platform supports it). Accepted types remain JPEG, PNG, and WebP. Import MUST append assets without clearing prior gallery entries.

#### Scenario: Import files via input fallback

- **WHEN** supported image files are supplied through the test file input
- **THEN** those assets appear in the filmstrip gallery in append order

#### Scenario: Second import appends

- **WHEN** the user imports additional supported files after a first import
- **THEN** the gallery retains the earlier assets and appends the new ones

#### Scenario: Reject unsupported type in a batch

- **WHEN** a batch includes a TIFF among supported images
- **THEN** supported images still enter the gallery and a visible per-file error is shown for the TIFF without aborting the batch

### Requirement: Filmstrip placeholders and thumbnails

The filmstrip SHALL list gallery assets horizontally with virtualization for long galleries. Each filmstrip item MUST size its slot from the asset’s aspect (fixed height, width derived from clamped aspect) so landscape, portrait, square, and non-standard ratios are visually distinct. Each new asset MUST show an aspect-ratio placeholder before its thumbnail is ready. Thumbnails MUST be orientation-corrected pre-sized previews that show the full photo within the slot (no default cover crop) and MUST load with asynchronous decoding. The system MUST keep object URLs for thumbnails in a bounded cache and MUST revoke URLs on eviction. During an active multi-file import the filmstrip MUST expose newly enqueued gallery ids as they become part of the gallery (paced so interaction stays within frame-budget gates); it MUST NOT withhold the full batch until import settles. The system MAY reserve scroll extent via a progress spacer for the expected batch size.

#### Scenario: Placeholder then thumbnail

- **WHEN** a supported image enters the gallery during or after import (including a single-file import)
- **THEN** a filmstrip item appears with a placeholder and later shows a preview thumbnail without requiring a full page reload

#### Scenario: Placeholders appear during multi-file import

- **WHEN** a multi-file import is running and gallery ids have been enqueued for accepted files
- **THEN** the filmstrip’s visible gallery count increases before the import progress reaches completion, and placeholders are available to scroll without waiting for the whole batch to finish

#### Scenario: Scroll a long gallery

- **WHEN** the gallery contains far more assets than fit on screen
- **THEN** the user can scroll the filmstrip horizontally and only near-viewport items need live thumbnail resources

#### Scenario: Portrait and landscape slots differ

- **WHEN** the gallery contains a portrait asset and a landscape asset with known corrected dimensions
- **THEN** the portrait filmstrip item is narrower than the landscape item at the same thumb height

#### Scenario: Full photo visible in thumb slot

- **WHEN** a thumbnail is ready for a non-square asset
- **THEN** the preview shows the entire photo within the item slot without cropping by default

### Requirement: Import progress

While a multi-file import is in progress, the system SHALL expose visible progress (completed vs total, or equivalent) on the filmstrip status strip and MUST continue accepting filmstrip scroll interaction. The filmstrip status strip MUST also show the current gallery photo count when the gallery is non-empty or an import is running.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress feedback is visible on the filmstrip status strip and the filmstrip remains scrollable

#### Scenario: Gallery count on status strip

- **WHEN** the gallery contains one or more assets
- **THEN** the filmstrip status strip shows the total photo count

### Requirement: Viewport-contained shell and filmstrip scroll

The editor shell SHALL fill the viewport without creating page-level horizontal or vertical scrollbars. When the gallery is longer than the visible filmstrip, horizontal scrolling MUST occur only inside the filmstrip scrollport, not by widening the document.

#### Scenario: Long gallery does not widen the page

- **WHEN** the gallery contains far more assets than fit on screen (including after a bulk import)
- **THEN** `document.documentElement.scrollWidth` MUST NOT exceed `document.documentElement.clientWidth`, and `document.documentElement.scrollHeight` MUST NOT exceed `document.documentElement.clientHeight` at the default desktop viewport

#### Scenario: Filmstrip is the horizontal scrollport

- **WHEN** the gallery is longer than the visible filmstrip region
- **THEN** the filmstrip scroll element has `scrollWidth` greater than `clientWidth`, and changing its `scrollLeft` scrolls the gallery without requiring document horizontal scroll

### Requirement: Workspace hosts the pasteboard

The editor workspace SHALL show the book's pasteboard. It MUST NOT show a placeholder sentence in place of that pasteboard.

#### Scenario: Workspace is not a placeholder

- **WHEN** the user opens the app
- **THEN** the workspace shows the pasteboard and does not show a sentence that the pasteboard arrives later

### Requirement: Active spread template and add spread

The editor SHALL offer a keyboard-reachable control that sets the active spread's template to full-bleed, one-per-page, 2-up, or 4-grid, and a keyboard-reachable control that appends a spread. The template control MUST show the active spread's current template. The appended spread MUST use the one-per-page template and MUST be brought into the pasteboard scrollport after it is laid out. Appending a spread MUST keep the committed zoom and the previous spread's scale. These controls MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread
- **THEN** the pasteboard spread count increases by one, the new spread uses one-per-page, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread keeps the fitted zoom

- **WHEN** the user chooses fit spread, notes the zoom percent and the previous last spread's on-screen height, then adds a spread
- **THEN** the zoom percent is unchanged, that previous spread keeps the same on-screen height while becoming two pages wide, the new one-page spread lies within the pasteboard scrollport, and the document element does not gain horizontal or vertical page scroll

#### Scenario: Template controls do not scroll the page

- **WHEN** the template control and the add-spread control are visible
- **THEN** the document element does not gain horizontal or vertical page scroll

### Requirement: Camera zoom controls

The editor SHALL offer keyboard-reachable controls for fit spread, fit width, and 100% physical size, plus a zoom indicator of the current zoom as a percent of physical size (96 CSS pixels per inch). These controls MUST NOT create page-level horizontal or vertical scroll. 100% MUST size a millimetre at 96 CSS pixels per inch.

#### Scenario: 100% shows physical size

- **WHEN** the user chooses 100%
- **THEN** the indicator reads 100% and the active spread's on-screen millimetres match 96 CSS pixels per inch

#### Scenario: Fit width matches the port

- **WHEN** the user chooses fit width
- **THEN** the active spread's width matches the pasteboard port width and the indicator shows the resulting physical-size percent

#### Scenario: Fit spread fits in the port

- **WHEN** the user chooses fit spread
- **THEN** the active spread fits inside the pasteboard port

#### Scenario: Camera controls do not scroll the page

- **WHEN** the camera controls and the zoom indicator are visible
- **THEN** the document element does not gain horizontal or vertical page scroll

### Requirement: Place and replace from the gallery

The editor SHALL place a selected gallery photo into an empty frame and SHALL replace a filled frame's photo, either by dropping that photo on the frame or by keyboard activation of the frame. Each drop or activation MUST apply one document operation. The photo MUST remain in the filmstrip.

#### Scenario: Place on an empty frame

- **WHEN** a gallery photo is placed on an empty frame
- **THEN** that frame shows the photo, the photo remains in the filmstrip, and that filmstrip item shows a Placed badge

#### Scenario: Replace a filled frame

- **WHEN** a second gallery photo replaces the photo in that frame and the first photo has no other placement
- **THEN** the frame shows the second photo, the first filmstrip item has no Placed badge, the second filmstrip item shows a Placed badge, and both photos remain in the filmstrip

#### Scenario: Keyboard activation without a selection

- **WHEN** no gallery photo is selected and a frame is activated from the keyboard
- **THEN** every frame stays as it was

### Requirement: Empty gallery shows no placements

When the gallery is empty, the filmstrip MUST NOT show a Placed badge or an Unplace control, and activating a frame MUST leave every frame a placeholder named “Place photo”.

#### Scenario: Empty gallery activation

- **WHEN** the gallery has no photos and a frame is activated
- **THEN** no Placed badge is shown, no Unplace control is shown, and every frame remains a placeholder named “Place photo”

### Requirement: Place and replace keep page scroll inside existing ports

Placing or replacing a photo MUST NOT create page-level horizontal or vertical scroll. Horizontal scrolling MUST stay inside the filmstrip, and vertical scrolling MUST stay inside the pasteboard.

#### Scenario: Document stays contained after place

- **WHEN** a gallery photo is placed on a frame
- **THEN** the document has no page-level horizontal or vertical scroll

### Requirement: Swap or move between frames

The editor SHALL swap the placements of two frames when a filled frame is dropped on another filled frame, including a frame on another spread. Dropping a filled frame on an empty frame SHALL move the placement. Dropping a frame on itself MUST NOT change the book. Each accepted drop MUST apply one document operation. Both photos MUST remain in the filmstrip.

#### Scenario: Swap two filled frames

- **WHEN** a filled frame is dropped on another filled frame
- **THEN** the two frames exchange photos, both photos remain in the filmstrip, and both filmstrip items show a Placed badge

#### Scenario: Move onto an empty frame

- **WHEN** a filled frame is dropped on an empty frame
- **THEN** the source frame is empty, the target frame shows that photo, and that filmstrip item still shows a Placed badge

#### Scenario: Drop on the same frame

- **WHEN** a filled frame is dropped on itself
- **THEN** every frame stays as it was

### Requirement: Unplace onto the filmstrip

The editor SHALL clear a filled frame when that frame is dropped on the filmstrip. The photo MUST remain in the filmstrip. The Placed badge MUST disappear when that photo has no placements left.

#### Scenario: Unplace the only placement

- **WHEN** a frame holding a photo with no other placement is dropped on the filmstrip
- **THEN** that frame is empty, the photo remains in the filmstrip, and that filmstrip item has no Placed badge

### Requirement: Keyboard swap, move, and unplace

With no gallery photo selected, the editor SHALL let a keyboard user mark a filled frame as the move source, then swap or move by activating another frame, or unplace with a filmstrip control. A selected gallery photo MUST still place or replace and MUST clear the move source. The move source MUST be the only pressed frame.

#### Scenario: Keyboard swap

- **WHEN** no gallery photo is selected, a filled frame named “Select photo to move” is activated, and another filled frame named “Swap photos” is activated
- **THEN** the two frames exchange photos and both Placed badges stay

#### Scenario: Keyboard move

- **WHEN** a move source is set and an empty frame named “Move photo here” is activated
- **THEN** the source frame is empty, the target shows the photo, and the Placed badge stays

#### Scenario: Keyboard unplace

- **WHEN** a move source is set and the filmstrip control named “Unplace” is activated
- **THEN** the source frame is empty, the photo remains in the filmstrip, and the Placed badge is removed when that photo has no other placement

#### Scenario: Gallery selection still replaces

- **WHEN** a gallery photo is selected and a filled frame is activated
- **THEN** that frame shows the selected photo, is named “Replace photo”, and the move source is cleared

#### Scenario: Activate the source again

- **WHEN** a filled frame is the move source and that same frame, named “Cancel move”, is activated
- **THEN** the move source is cleared and no frame stays pressed

#### Scenario: Escape clears move mode

- **WHEN** a move source or a gallery photo is selected and Escape is pressed in the editor
- **THEN** the move source and the gallery selection are both cleared

#### Scenario: Delete unplaces the focused frame

- **WHEN** a filled frame has focus and Delete or Backspace is pressed
- **THEN** that frame is empty, the photo remains in the filmstrip, and the Placed badge is removed when that photo has no other placement

#### Scenario: Delete ignores a text field

- **WHEN** focus is in a text field and Backspace or Delete is pressed
- **THEN** every frame stays as it was

#### Scenario: Unplace keeps focus and announces

- **WHEN** the move source is set and Unplace is activated
- **THEN** focus is on the emptied frame, not the document body, and a polite live region reports that the photo was unplaced

#### Scenario: Status follows swap and move

- **WHEN** a move source is chosen, then swapped or moved
- **THEN** the live region reports the selection, then that the photos were swapped or the photo was moved

### Requirement: Move source matches a filled frame

The editor MUST clear the move source when its frame is missing or empty, including after a template change or a book reset. An Unplace control MUST stay in the filmstrip and MUST be unavailable while no move source is set, so the filmstrip does not change height. A frame drag MUST unplace or swap only when that drag started in this document and the dropped payload is that same frame. A drag MUST clear the keyboard move source only when the dragged frame is that source.

#### Scenario: Template change drops a stale source

- **WHEN** the move source is a frame that a template change removes
- **THEN** the move source is cleared and Unplace is unavailable

#### Scenario: Foreign frame drop

- **WHEN** a frame payload is dropped on the filmstrip without a matching drag started in this document
- **THEN** every frame stays as it was

#### Scenario: Unrelated drag keeps the move source

- **WHEN** a keyboard move source is set and a different frame is dragged onto another frame
- **THEN** the move source stays on the original frame

### Requirement: Pressed move source stays visible

The move source frame MUST show a visible outline while it is pressed, including when the book is zoomed far out.

#### Scenario: Pressed frame has an outline

- **WHEN** a filled frame is the move source
- **THEN** that frame’s outline is wider than zero

### Requirement: Rearrange keeps page scroll inside existing ports

Swapping, moving, or unplacing MUST NOT create page-level horizontal or vertical scroll. Horizontal scrolling MUST stay inside the filmstrip, and vertical scrolling MUST stay inside the pasteboard.

#### Scenario: Document stays contained after unplace

- **WHEN** a photo is unplaced from a frame
- **THEN** the document has no page-level horizontal or vertical scroll

### Requirement: Smaller template announces unplaced photos

When the user chooses a template and that change removes one or more placements, the editor MUST set the polite live region to `1 photo was unplaced from the spread` for one removal, or `N photos were unplaced from the spread` for N greater than one. Removed photos MUST stay in the gallery. Choosing a template that removes no placements MUST leave that live region unchanged.

#### Scenario: Overflow placements are announced

- **WHEN** a filled spread is switched to a template with fewer slots
- **THEN** photos that still have slots stay on the spread and keep a Placed badge, overflow photos leave the spread but stay in the gallery, those filmstrip items lose Placed when they have no placement left, and the polite live region reads `1 photo was unplaced from the spread` or `N photos were unplaced from the spread` for that removal count

#### Scenario: No removals leave an earlier status

- **WHEN** the polite live region already has a message and a template change removes no placements
- **THEN** that message is unchanged

#### Scenario: Empty gallery template change

- **WHEN** the gallery is empty and the user chooses another template
- **THEN** no Placed badge is shown and the polite live region stays empty

#### Scenario: Smaller template stays on the page

- **WHEN** the user chooses a smaller template on the active spread
- **THEN** the document element does not gain horizontal or vertical page scroll

### Requirement: Filmstrip thumbnail file name

The filmstrip MUST label each thumbnail with that asset’s session file name when one is present. When no session file name is present, the thumbnail MUST be labeled with the asset id. That label MUST be the thumbnail’s accessible name. Selection and drag identity MUST remain the asset id.

#### Scenario: Cyrillic file name

- **WHEN** a gallery asset’s session metadata stores the file name `фото отпуск 01.jpg`
- **THEN** that thumbnail’s accessible name is `фото отпуск 01.jpg`

#### Scenario: Missing session file name

- **WHEN** a gallery asset has no session file name
- **THEN** that thumbnail’s accessible name is the asset id

#### Scenario: Empty gallery

- **WHEN** the gallery has no assets
- **THEN** the filmstrip shows “Add a folder or photos to build the gallery.” and shows no thumbnail

#### Scenario: Activate the named thumbnail

- **WHEN** the user activates a thumbnail whose accessible name is the imported file name
- **THEN** that thumbnail is selected, the document has no page-level scroll, and horizontal scrolling stays inside the filmstrip

### Requirement: Thumbnail bytes use derived cache when hashed

When an asset has a known `contentHash`, the system SHALL persist filmstrip thumbnail preview bytes in the derived cache under that hash and a thumbnail preset id, and SHALL attempt to hydrate a missing hot object URL from the derived cache before requesting a new thumbnail encode.

#### Scenario: Hashed asset hydrates thumbnail from derived cache

- **WHEN** a filmstrip thumbnail’s hot object URL is missing, the asset has a `contentHash`, and the derived cache already holds the thumbnail preset
- **THEN** the system publishes a hot object URL from the cached bytes without encoding the original again

#### Scenario: Hashed asset stores thumbnail after encode

- **WHEN** a thumbnail preview is produced for an asset that has a `contentHash`
- **THEN** those preview bytes are put into the derived cache under that hash and the thumbnail preset id

### Requirement: Unhashed thumbnails stay memory-only

When `contentHash` is absent, thumbnail caching MUST remain memory-only without writing fake hash keys. Filmstrip layout, virtualization, and accessible naming MUST remain unchanged.

#### Scenario: Unhashed asset skips derived cache for thumbnails

- **WHEN** a thumbnail preview is produced for an asset without a `contentHash`
- **THEN** the system does not put a derived-cache entry under a fabricated hash

### Requirement: Create or open a library folder

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker. With no library open, chrome MUST offer create/open actions. Opening or creating MUST remember the library handle in session state for later restore. After a successful **create** with no active book id, the system MUST adopt the current in-memory book so Save can persist it without a destructive empty-book create. After a successful **open** of a library that already contains books, when the editor has no gallery or placements, the system MUST load a stored book into the editor (preferring a book with content over an empty placeholder) instead of adopting a fresh empty session book. When the editor already has session content, open MUST still adopt that work without clearing gallery or placements. The shell MUST remain viewport-contained (no page-level H/V scroll; filmstrip and pasteboard stay the named scrollports).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open
- **THEN** create-library and open-library actions are visible and the filmstrip and pasteboard remain the only scrollports

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

#### Scenario: Create library adopts in-memory book

- **WHEN** the user creates a library while an in-memory book is already in the editor and no book id is active
- **THEN** that book becomes the active library-backed book without clearing gallery or placements

#### Scenario: Open existing library loads stored book

- **WHEN** the user opens a library that already contains a saved book and the editor is empty
- **THEN** the editor shows that book’s gallery and placements without requiring a reload

#### Scenario: Open prefers filled book over empty session book

- **WHEN** the library contains an empty session-book placeholder and another book with gallery content, and the editor is empty
- **THEN** open activates the filled book

### Requirement: Adopt in-memory book into open library

When a library is open and no library-backed book id is active yet, the system SHALL adopt the current in-memory editor book into that library (persist it and mark it active) without clearing gallery or placements. When adopt finds an existing book id already on disk and the editor is empty, it MUST load that stored document into the editor instead of leaving the empty in-memory placeholder active. Create library and open-of-empty-library MUST leave a path to Save without requiring a destructive empty-book create. Save and Ctrl/Cmd+S MUST be available whenever a library is open (adopting first when needed).

#### Scenario: Save after create library keeps session work

- **WHEN** the user has imported or edited a session-only book, creates a library, and saves without creating a new empty book
- **THEN** the in-memory gallery and placements become the active library-backed book and persist under that book id

#### Scenario: Adopt of existing id hydrates empty editor

- **WHEN** the in-memory editor is empty, a library is bound, and storage already has a book with the same id that has gallery content
- **THEN** the editor loads that stored book (gallery and placements) as the active document

#### Scenario: Cancel keeps document when confirming new book

- **WHEN** a library is open, the editor gallery or placements are non-empty, and the user declines the create-new-book confirmation
- **THEN** the active document is unchanged

#### Scenario: Confirm creates empty book

- **WHEN** a library is open, the editor gallery or placements are non-empty, and the user confirms create-new-book
- **THEN** the editor shows a new empty book as the active document

### Requirement: Upgrade session assets on adopt

When adopting a session-only book into a library, the system SHALL write durable asset identity for gallery assets that still have in-session original files and MUST obtain `contentHash` values before treating the first post-adopt save as durable for preview hydrate. Assets already carrying complete identity MUST NOT be rewritten.

#### Scenario: Session import then adopt writes identity and hash

- **WHEN** assets were imported without a library and the book is adopted into an open library while session Files remain
- **THEN** those assets gain identity fields and `contentHash` values needed for derived-cache hydrate after reload

### Requirement: Create a book in the open library

When a library is open, the system SHALL let the user create a book. The new book MUST become the active editor document and MUST be persisted under the library's book layout on create.

#### Scenario: Create book becomes active

- **WHEN** the user creates a book in an open library
- **THEN** the editor shows that book as the active document and a subsequent load of the same book id from library storage returns the created gallery and layout

### Requirement: Save book with keyboard shortcut

When a library-backed book is active, the system SHALL save the current book document on Ctrl/Cmd+S (and an equivalent chrome save action). Save MUST persist gallery and layout to library storage. Typed failures (`permission-required`, `locked-elsewhere`, and other storage failure codes) MUST surface as non-blocking status text without clearing the in-memory book.

#### Scenario: Ctrl/Cmd+S persists gallery and layout

- **WHEN** the user edits gallery or layout on a library-backed book and presses Ctrl/Cmd+S
- **THEN** library storage holds the updated gallery and layout for that book id

#### Scenario: Save failure shows status

- **WHEN** save returns a typed failure such as `permission-required` or `locked-elsewhere`
- **THEN** a non-blocking status message is shown and the in-memory book is unchanged

### Requirement: Restore book after reload when handle is granted

After a successful save, when the tab is reloaded and session state can recall a library handle that still has readwrite permission, the system SHALL restore the previously active library-backed book so gallery ids and placements match what was saved.

#### Scenario: Reload restores saved book

- **WHEN** the user has saved a library-backed book, the tab reloads, and the remembered library handle is still granted
- **THEN** the editor restores the same book id with the same gallery ids and placements

### Requirement: Hashed previews rehydrate after restore

After restore, thumbnail and placed-frame previews MUST rehydrate from the derived cache when asset `contentHash` values are present. When a zoom-tier entry is missing but a thumbnail derivative exists for the same hash, the system MUST use that derivative so placed frames are not left empty solely because a tier preset was never written. Reattaching live photo-folder originals is out of scope for this capability.

#### Scenario: Hashed previews rehydrate after restore

- **WHEN** a restored book’s assets include `contentHash` values and derived-cache entries exist for those hashes
- **THEN** filmstrip thumbnails (and zoom tiers when requested) hydrate without requiring photo-folder reattachment

#### Scenario: Thumb derivative fills placed frame when tier missing

- **WHEN** a restored placed asset has a `contentHash`, a thumbnail derived-cache entry exists, and the requested zoom-tier entry is missing
- **THEN** the placed frame still shows a preview image from the thumbnail derivative

### Requirement: Durable hashed previews after save and reload

After a durable save of hashed assets, a reload that restores the book MUST show filmstrip thumbnails and placed-frame previews from the derived cache without photo-folder reattachment. Session aspect used for cover crop MUST be restored from hydrated preview dimensions when session meta was cleared by restore.

#### Scenario: Reload shows thumbs and placed frames

- **WHEN** the user saves a library-backed book whose assets have `contentHash` and derived-cache preview bytes, then reloads with a granted library handle
- **THEN** filmstrip thumbnails and placed frames show images rather than empty placeholders

#### Scenario: Landscape crop not square-forced after reload

- **WHEN** a landscape photo was placed before save and the book is restored after reload
- **THEN** the placed preview uses a non-square cover crop consistent with the photo’s aspect

### Requirement: Permission-required defers library restore

When recalling the library handle returns `permission-required`, the system MUST leave restore incomplete until the user opens the same folder again via the picker. Full re-grant UX is out of scope.

#### Scenario: Permission-required defers restore

- **WHEN** the tab reloads and recalling the library handle returns `permission-required`
- **THEN** the book is not silently loaded from disk and the user can open the library folder again via the picker

### Requirement: Library-backed import registers source roots

When the active book is library-backed, importing a folder or files MUST register a source root for those originals and MUST write asset identity fields (`sourceRootId`, `relativePath`, and hash-related fields once available) onto gallery assets so the book can reopen against those roots. Session-only File maps MAY remain for in-session decode. Import without an open library MAY keep today's session-only behavior.

#### Scenario: Folder import registers a source root

- **WHEN** the user imports a folder into a library-backed book
- **THEN** a source root is registered for that folder and gallery assets from that import carry `sourceRootId` and `relativePath`

#### Scenario: Import without library stays session-only

- **WHEN** the user imports files with no library open
- **THEN** assets still appear in the filmstrip without requiring source-root registration

### Requirement: Debounced autosave for library-backed books

When a library-backed book is dirty from document edits, the system SHALL persist it automatically after a short idle debounce without requiring Ctrl/Cmd+S. Autosave MUST reuse the durable save path (pending hashes, background serialization) and MUST NOT start during an active pointer drag or camera zoom gesture.

#### Scenario: Idle edit persists without manual save

- **WHEN** the user edits a library-backed book and then stays idle long enough for the debounce to fire with no active gesture
- **THEN** library storage holds the updated gallery and layout for that book id without Ctrl/Cmd+S

#### Scenario: Autosave waits for gesture end

- **WHEN** the book is dirty and a drag or zoom gesture is active through the debounce window
- **THEN** autosave does not start until the gesture ends, after which a new debounce may persist the book

#### Scenario: Reload keeps autosaved edits

- **WHEN** the user edits a library-backed book, autosave completes, and the tab reloads with a granted library handle
- **THEN** the restored book matches the autosaved gallery ids and placements

#### Scenario: Autosave failure keeps the in-memory book

- **WHEN** autosave returns a typed failure such as `permission-required` or `locked-elsewhere`
- **THEN** a non-blocking status message is shown and the in-memory book is unchanged

### Requirement: Save indicator in editor chrome

While a library is open, the editor chrome SHALL expose a save indicator for clean (saved/idle), pending debounce, saving, or last-save error. The indicator MUST NOT create page-level horizontal or vertical scroll; filmstrip and pasteboard remain the only named scrollports.

#### Scenario: Indicator after idle edit reaches saved

- **WHEN** the user edits a library-backed book and then idles with no active gesture until autosave finishes successfully
- **THEN** the save indicator shows a pending or saving state during the cycle and reaches a saved/idle state afterward

#### Scenario: Clean library-backed book shows saved

- **WHEN** a library-backed book is open and has no unsaved edits
- **THEN** the save indicator shows a saved or idle state and the shell stays viewport-contained

#### Scenario: Manual save clears dirty

- **WHEN** the user presses Ctrl/Cmd+S or the chrome Save action on a dirty library-backed book and save succeeds
- **THEN** the save indicator reaches a saved/idle state

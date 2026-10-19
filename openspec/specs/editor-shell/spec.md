# editor-shell Specification

## Purpose

Editor chrome that presents a workspace above a book-gallery filmstrip, and lets the user import local folders or files into that gallery with visible progress.

## Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell with a workspace region above a horizontal filmstrip when the editor surface is active. When the app opens with no in-tab active book to restore, the home screen MUST be the primary surface instead of the editor shell. The legacy single photo-card success screen MUST NOT be the primary layout.

#### Scenario: Shell visible on load

- **WHEN** the editor surface is active (including after opening a book or restoring an in-tab active book)
- **THEN** a workspace region and a filmstrip region are visible, and the legacy single photo-card success screen is not the primary layout

#### Scenario: Home is primary without in-tab book

- **WHEN** the user opens the app with no in-tab active book to restore
- **THEN** the home screen is the primary surface and the editor workspace and filmstrip are not required to be visible

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

When the editor surface is active, the editor workspace SHALL show the book's pasteboard. It MUST NOT show a placeholder sentence in place of that pasteboard.

#### Scenario: Workspace is not a placeholder

- **WHEN** the editor surface is active
- **THEN** the workspace shows the pasteboard and does not show a sentence that the pasteboard arrives later

### Requirement: Active spread template and add spread

The editor SHALL offer a keyboard-reachable control that sets the active spread's template to full-bleed, one-per-page, 2-up, or 4-grid, and a keyboard-reachable control that appends a spread. The template control MUST show the active spread's current template. The appended spread MUST use the one-per-page template and MUST be brought fully into the pasteboard scrollport after it is laid out, including after fit-spread or fit-width when the laid-out box fits one axis but still overflows the other. Appending a spread MUST keep the committed zoom and the previous spread's scale. These controls MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread
- **THEN** the pasteboard spread count increases by one, the new spread uses one-per-page, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread keeps the fitted zoom

- **WHEN** the user chooses fit spread, notes the zoom percent and the previous last spread's on-screen height, then adds a spread
- **THEN** the zoom percent is unchanged, that previous spread keeps the same on-screen height while becoming two pages wide, the new one-page spread lies within the pasteboard scrollport, and the document element does not gain horizontal or vertical page scroll

#### Scenario: Add spread contains after fit on a narrow viewport

- **WHEN** the viewport is about 400 CSS pixels wide, the user chooses fit spread or fit width, then adds a spread
- **THEN** the new spread lies fully within the pasteboard scrollport and the document element does not gain horizontal page scroll

#### Scenario: Add spread contains after fit from mid-scroll on desktop

- **WHEN** on a desktop-sized viewport the pasteboard is scrolled partway through the stack, the user chooses fit spread or fit width, then adds a spread
- **THEN** the new spread lies fully within the pasteboard scrollport after the reveal and the document element does not gain horizontal page scroll

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

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker in development and e2e builds only. With no library open, create/open actions MUST be available from the home screen (and MAY remain reachable from editor chrome after leaving home). Opening or creating MUST remember the library handle and update the recent-libraries list only after success. When create library runs while a library-backed book is open, the system MUST obtain a picked folder first; cancelling the picker MUST leave the current book open with its lock held. After a successful pick, the system MUST flush pending saves, release the previous book, and start a clean empty book in the new folder without copying the previous book file; the filmstrip MUST reflect the new folder. After a successful create with no active book id and no library-backed book open, the system MUST adopt the current in-memory book so Save can persist it. After a successful open of a library that already contains books, when the editor has no gallery or placements (including after Home cleared the document), the system MUST load a stored book into the editor (preferring a book with content over an empty placeholder) and MUST NOT adopt a document that belonged to another library. When the editor already has unsaved session-only content and no library-backed book is open, open MUST still adopt that work without clearing gallery or placements. Editor create/open/Home actions MUST be disabled or no-op while restore is pending. The shell MUST remain viewport-contained (no page-level H/V scroll; home, filmstrip, and pasteboard stay the named scrollports for their respective surfaces).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open and no in-tab active book to restore
- **THEN** create-library and open-library actions are visible on the home screen and the document does not grow page-level H/V scrollbars

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam in a development or e2e build
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

#### Scenario: Create library adopts in-memory book

- **WHEN** the user creates a library while an in-memory book is already in the editor and no book id is active
- **THEN** that book becomes the active library-backed book without clearing gallery or placements

#### Scenario: Create library while a book is open starts clean

- **WHEN** the user creates a new library while a library-backed book is open in the editor and picks a folder
- **THEN** the previous book is released after the pick, the new folder does not receive a copy of that book, and the editor shows a clean book with the new folder’s photos in the filmstrip

#### Scenario: Create library picker cancel keeps the book

- **WHEN** the user activates New library while a library-backed book is open and cancels the folder picker
- **THEN** the same book remains open with its lock still held and the library binding unchanged

#### Scenario: Open existing library loads stored book

- **WHEN** the user opens a library that already contains a saved book and the editor is empty
- **THEN** the editor shows that book’s gallery and placements without requiring a reload

#### Scenario: Open prefers filled book over empty session book

- **WHEN** the library contains an empty session-book placeholder and another book with gallery content, and the editor is empty
- **THEN** open activates the filled book

#### Scenario: Editor actions wait for restore

- **WHEN** in-tab restore is still pending
- **THEN** editor New library, Open, and Home actions are not interactive

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

When a library is open, the system SHALL let the user create a book. Create MUST ask for a title before persisting. Cancelled title entry MUST NOT create a book. An accepted empty or whitespace title MUST store an empty title (displayed via the Untitled fallback). The new book MUST become the active editor document and MUST be persisted under the library's book layout on create, including the chosen title.

#### Scenario: Create book becomes active

- **WHEN** the user creates a book in an open library
- **THEN** the editor shows that book as the active document and a subsequent load of the same book id from library storage returns the created gallery and layout

#### Scenario: Create book asks for title and persists it

- **WHEN** the user creates a book and enters title `"Summer"`
- **THEN** the active document and a subsequent load of that book id have `title` `"Summer"`, and the editor chrome shows `"Summer"`

#### Scenario: Cancelled create does not persist a book

- **WHEN** the user starts create book and cancels the title entry
- **THEN** no new book id is added to library storage and the previously active document (if any) remains active

### Requirement: Save book with keyboard shortcut

When a library-backed book is active, the system SHALL save the current book document on Ctrl/Cmd+S (and an equivalent chrome save action). Save MUST persist gallery and layout to library storage. Typed failures (`permission-required`, `locked-elsewhere`, and other storage failure codes) MUST surface as non-blocking status text without clearing the in-memory book.

#### Scenario: Ctrl/Cmd+S persists gallery and layout

- **WHEN** the user edits gallery or layout on a library-backed book and presses Ctrl/Cmd+S
- **THEN** library storage holds the updated gallery and layout for that book id

#### Scenario: Save failure shows status

- **WHEN** save returns a typed failure such as `permission-required` or `locked-elsewhere`
- **THEN** a non-blocking status message is shown and the in-memory book is unchanged

### Requirement: Restore book after reload when handle is granted

After a successful save, when the tab is reloaded and session state can recall a library handle that still has readwrite permission **and** an in-tab active book id is still present, the system SHALL restore the previously active library-backed book so gallery ids and placements match what was saved. When the tab opens without an in-tab active book id, the system MUST show the home screen instead of auto-entering the editor. When restore fails, the system MUST clear stale in-tab and session active ids and library binding and show home. While restore is pending, the editor chrome MUST NOT accept library-switching actions.

#### Scenario: Reload restores saved book

- **WHEN** the user has saved a library-backed book, the tab reloads, and the remembered library handle is still granted with an in-tab active book id present
- **THEN** the editor restores the same book id with the same gallery ids and placements

#### Scenario: Fresh visit shows home with recents

- **WHEN** the user previously used a library so it is recent, then opens the app with no in-tab active book id
- **THEN** the home screen is shown listing that recent library rather than auto-entering the editor

#### Scenario: Failed restore clears stale state

- **WHEN** restore cannot open the in-tab active book
- **THEN** stale active ids and library binding are cleared and the home screen is shown

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

When recalling the library handle returns `permission-required`, or when save/autosave fails with `permission-required`, the system MUST leave durable library access incomplete until the user re-grants access. The editor chrome MUST expose a keyboard-reachable control that, in one activation, opens the directory picker so the user can choose the same library folder again. After restore-time re-grant, library-backed editing MUST resume from the last saved book. After mid-session re-grant, the in-memory book MUST be kept and Save MAY retry. The control MUST NOT appear when permission is already granted. The control MUST NOT create page-level horizontal or vertical scroll; filmstrip and pasteboard remain the only named scrollports.

#### Scenario: Permission-required defers restore

- **WHEN** the tab reloads and recalling the library handle returns `permission-required`
- **THEN** the book is not silently loaded from disk and the editor shows a re-grant control

#### Scenario: One-step re-grant resumes editing

- **WHEN** restore failed with `permission-required` and the user activates the re-grant control and picks the same library folder with readwrite access
- **THEN** the previously active library-backed book is restored so gallery ids and placements match what was last saved

#### Scenario: No re-grant control when permission granted

- **WHEN** a library-backed book is open with a granted handle
- **THEN** the re-grant control is not shown

#### Scenario: Mid-session re-grant keeps in-memory edits

- **WHEN** save or autosave fails with `permission-required` and the user activates the re-grant control and picks the library folder with readwrite access
- **THEN** the in-memory book is not replaced from disk and a subsequent save may persist that in-memory document

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

### Requirement: Single-writer lock for the active book

When the editor activates a library-backed book (create, open, restore, or adopt), it MUST acquire that book's exclusive session lock and MUST hold it until the book is left or the library is detached. Leaving the book or detaching the library MUST release the lock.

#### Scenario: Activating a book acquires the lock

- **WHEN** the editor successfully activates a library-backed book
- **THEN** that book's session lock is held by this tab

#### Scenario: Leaving the book releases the lock

- **WHEN** the editor leaves the active library-backed book or detaches the library while holding the lock
- **THEN** the lock is released so another tab may acquire it

### Requirement: Locked-elsewhere blocks editing

When acquiring the book lock returns `locked-elsewhere`, the editor MUST NOT activate writable library-backed editing for that book. The chrome MUST show a clear non-blocking message that the book is open in another tab. Save and document mutations for that book MUST remain unavailable. Open library and New book MUST stay reachable so the user can leave the blocked state. The message MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Second tab sees open-in-another-tab message

- **WHEN** one tab already holds the lock for a book and a second tab tries to activate the same library-backed book
- **THEN** the second tab shows a message that the book is open in another tab and does not become a writable library-backed editor for that book

#### Scenario: Locked tab cannot save

- **WHEN** the editor is blocked with `locked-elsewhere` for a book
- **THEN** Save and autosave do not persist that book from this tab

#### Scenario: Different book or new book clears the lock message

- **WHEN** the editor is blocked with `locked-elsewhere` and the user successfully activates a different book or creates a new book that acquires its lock
- **THEN** the open-in-another-tab message is cleared

#### Scenario: Same contended book keeps the lock message

- **WHEN** the editor is blocked with `locked-elsewhere` for a book and the user again tries to activate that same book while another tab still holds the lock
- **THEN** the open-in-another-tab message remains

### Requirement: Home screen for returning users

When the app opens with no in-tab active book to restore, the system SHALL show a home screen as the primary surface instead of the editor workspace. Until restore has settled, the system MUST show a non-interactive loading state and MUST NOT accept home actions. The home screen MUST list recent libraries and offer create-library and open-library actions. When listing fails, the home screen MUST show an explicit error state with retry instead of the empty-recents copy. When a last active library id is stored, home MUST preselect that library when it is still recent.

#### Scenario: Empty home with no recents

- **WHEN** the user opens the app with no recent libraries and no in-tab active book to restore and session listing succeeds
- **THEN** the home screen shows empty copy plus create-library and open-library actions, and the document does not grow page-level H/V scrollbars

#### Scenario: Home lists recent libraries

- **WHEN** the user previously opened a library so it is remembered in session state, then opens the app with no in-tab active book to restore
- **THEN** the home screen lists that recent library by its display label

#### Scenario: Home shows error when listing fails

- **WHEN** listing recent libraries fails
- **THEN** the home screen shows an explicit error state with a retry action and does not show the empty-recents copy

#### Scenario: Home waits for restore before interactivity

- **WHEN** the app is still resolving in-tab restore
- **THEN** home actions are not interactive until restore settles

#### Scenario: Home preselects last active library

- **WHEN** session state has a last active library id that is still recent
- **THEN** that library is selected on home without a further click

### Requirement: Home lists books for a selected recent library

Selecting a recent library on the home screen MUST list that library’s books by display title (document `title`, or `"Untitled book"` when empty/missing) when the remembered handle can be used. When recalling the handle returns `permission-required`, the system MUST show a permission hint and the re-grant control and MUST NOT show a silent empty book list.

#### Scenario: Home lists books for a recent library

- **WHEN** the home screen shows a recent library whose handle is granted and that library contains saved books
- **THEN** those books are listed so the user can choose one

#### Scenario: Home lists books by title not raw id

- **WHEN** a library contains a book with `title` `"Summer"` and another with an empty title
- **THEN** the home book list shows `"Summer"` and `"Untitled book"` rather than only the raw book ids as the primary labels

#### Scenario: Permission-required selecting a recent uses re-grant

- **WHEN** the user selects a recent library whose handle recall returns `permission-required`
- **THEN** the books panel shows a permission hint and the re-grant control, not a silent empty book list

### Requirement: Home scrollport containment

The home screen MUST remain viewport-contained (no page-level H/V scroll). When the recent or book list overflows the viewport, scrolling MUST occur only inside a named home scrollport.

#### Scenario: Home overflow stays in named scrollport

- **WHEN** the home recent or book list is longer than the viewport
- **THEN** scrolling occurs only inside the named home scrollport and the document does not grow page-level H/V scrollbars

### Requirement: Open book from home in one click

From the home screen, activating a listed book MUST open that book into the editor in one activation when the library handle is granted. The editor MUST show that book’s gallery and placements. After a successful open, filmstrip and pasteboard MUST be the named editor scrollports. When recall returns `permission-required`, the system MUST remember that book for re-grant and show the re-grant control. A failed open MUST leave recent order unchanged and MUST show a human-readable error on home. Home create, open, grant, and open-book actions MUST be serialized while busy. After a locked-elsewhere failure from home, the home surface MUST clear the locked access phase so later Start editing does not show a lock banner.

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book on the home screen for a recent library with a granted handle
- **THEN** the editor becomes the active surface showing that book’s gallery and placements

#### Scenario: Permission-required opening a book uses re-grant

- **WHEN** the user activates a listed book and handle recall returns `permission-required`
- **THEN** the system remembers that book for re-grant, shows the re-grant control, and the editor does not open an empty silent library

#### Scenario: Failed open does not reorder recents

- **WHEN** opening a book fails because it is locked elsewhere
- **THEN** the home screen shows a human-readable locked message and the recent-libraries order is unchanged

#### Scenario: Locked-elsewhere from home clears on home surface

- **WHEN** opening a book from home fails with locked-elsewhere
- **THEN** the home surface does not keep a locked access phase that would banner Start editing

### Requirement: Leave editor for home

While the editor surface is active, the shell MUST provide a Home control. Activating Home MUST flush pending saves, then release the book lock, clear the in-tab active book id, reset the in-memory document and session assets, and show home. Flush or save-error failure MUST keep the editor with a readable message. After Home, another library MUST NOT receive the previous book file.

#### Scenario: Home control returns to home

- **WHEN** the user activates Home in the editor chrome and any pending save succeeds (or there is nothing to flush)
- **THEN** the home screen is shown, the in-memory book is cleared, and a same-tab reload does not restore the previous book into the editor

#### Scenario: Home after edit persists then leaves

- **WHEN** the user edits a library-backed book and activates Home before the autosave debounce fires
- **THEN** that edit is persisted and the home screen is shown

#### Scenario: Home blocked when save is in error

- **WHEN** the active book is in a save error phase and the user activates Home
- **THEN** the editor stays active with a human-readable message and the book is not cleared

#### Scenario: Home then open other library does not leak the book

- **WHEN** the user leaves a library-backed book with placements via Home, then opens a different library that already has its own book
- **THEN** the editor shows the opened library’s book and that library’s storage does not gain a copy of the previous book file

### Requirement: Re-grant from home opens the remembered book

Re-grant from home MUST prefer `requestPermission` on the stored directory handle. Only when that fails MAY the system fall back to a folder picker. After a picker, the system MUST verify `isSameEntry` against the stored handle before binding; a mismatch MUST show an error and MUST NOT replace the recent. On success, the system MUST open the book the user originally activated when one was pending.

#### Scenario: Grant access uses requestPermission then opens pending book

- **WHEN** the user activates Grant access after choosing a book that required permission and `requestPermission` succeeds
- **THEN** that same book opens in the editor

#### Scenario: Picker mismatch does not bind

- **WHEN** re-grant falls back to the folder picker and the picked folder is not the same entry as the stored handle
- **THEN** the home screen shows an error and the recent library handle is unchanged

#### Scenario: Don't Allow shows a message

- **WHEN** the user denies write permission during re-grant
- **THEN** the home screen shows a human-readable permission message and does not silently do nothing

### Requirement: Same-folder library identity

When creating or opening a library folder that matches an already remembered recent via `isSameEntry`, the system MUST reuse that library id even when the stored handle does not currently have permission. The system MUST NOT insert a duplicate recent for the same folder.

#### Scenario: Reopening the same folder reuses the recent

- **WHEN** the user opens a folder that is already a recent library (including after a browser restart where permission is not yet granted)
- **THEN** session state keeps a single recent entry for that folder

### Requirement: Book title display fallback

Wherever the shell shows a book title (home book list and editor chrome), the system SHALL show the document `title` when it is a non-empty string after trim, and SHALL show `"Untitled book"` when the title is missing, empty, or whitespace-only. The fallback MUST NOT be written into library storage as the document title.

#### Scenario: Empty title shows Untitled book

- **WHEN** a listed or open book has an empty or missing `title`
- **THEN** the home list and editor chrome show `"Untitled book"` and a subsequent load of that book still has an empty or missing stored `title`

#### Scenario: Non-empty title shown as stored

- **WHEN** a book has `title` `"Summer"`
- **THEN** the home list and editor chrome show `"Summer"`

### Requirement: Rename book from home and editor

The system SHALL let the user rename a book from the home book list and from the editor chrome. A successful rename MUST update the document `title` and persist it to library storage. Renaming a book that is not the active editor document MUST NOT replace the active editor book. Cancelled rename MUST leave the title unchanged.

#### Scenario: Rename from editor persists

- **WHEN** the user renames the active library-backed book from the editor chrome to `"Trip"` and save completes
- **THEN** library storage holds `title` `"Trip"` for that book id and the chrome shows `"Trip"`

#### Scenario: Rename from home persists without swapping the open book

- **WHEN** the home list shows book A and the editor (or no editor book) is not editing A, and the user renames A to `"Album"`
- **THEN** a later list/load of A shows `"Album"` and the previously active editor document (if any) is unchanged

#### Scenario: Cancelled rename leaves title

- **WHEN** the user starts rename and cancels
- **THEN** the stored and displayed title are unchanged

### Requirement: Rename while filmstrip scrolls stays within frame budget

Title rename MUST be a local document string update that does not introduce layout thrash. Renaming while the filmstrip is scrolling MUST produce zero LoAF entries for the interaction window under the project frame-budget gate.

#### Scenario: Rename during filmstrip scroll has zero LoAF

- **WHEN** the user renames the active book while the filmstrip is scrolling
- **THEN** the measured interaction window reports zero LoAF entries

### Requirement: Copy FileList before clearing the file input

When the editor reads `input.files` from a file or folder input and then clears the input with `value = ''`, it MUST copy the `FileList` into a stable array first. `FileList` is live and becomes empty when the value is cleared.

#### Scenario: Clearing the input keeps the import file list

- **WHEN** the user selects files and the handler copies `input.files` then sets `input.value` to empty
- **THEN** the import proceeds with the copied files (not an empty list)

### Requirement: Open existing library loads stored book content

Opening an existing library MUST load a stored book into the editor (preferring a contentful book when several exist). The editor MUST NOT treat “same id as the in-memory `session-book` placeholder already exists” as a no-op adopt that leaves the empty placeholder on screen while disk holds the real document.

#### Scenario: Re-open shows stored book not empty placeholder

- **WHEN** the user opens a library that already has a stored book with content
- **THEN** the editor shows that stored book rather than an empty in-memory placeholder with the same id

### Requirement: Variable-width filmstrip packing uses absolute offsets

Variable-width filmstrip packing MUST place cards using absolute offsets from each card’s end plus gap. It MUST NOT use a fixed max-width stride (`estimatedRowSize` / uniform slot) for variable-aspect galleries.

#### Scenario: Portrait and landscape cards pack without uniform stride holes

- **WHEN** the gallery mixes portrait and landscape assets with known aspects
- **THEN** filmstrip layout positions follow per-card end+gap offsets rather than a single fixed stride

### Requirement: Sliding filmstrip window covers scrollport from aspects

The filmstrip virtual window MUST cover the scrollport width plus overscan using aspect-derived strides. A fixed mounted item count that ignores aspect width MUST NOT leave mid-scroll holes for narrow (portrait) cards.

#### Scenario: Mid-scroll window covers the filmstrip port

- **WHEN** a long mixed-aspect gallery is scrolled to a mid position with more items remaining
- **THEN** the mounted filmstrip window covers the visible scrollport (with overscan) without portrait-sized holes

### Requirement: Empty gallery UI spans the filmstrip scrollport

When the gallery is empty, empty-state copy MUST render at full filmstrip scrollport width. It MUST NOT be laid out inside a 1px / min-width virtualizer window.

#### Scenario: Empty copy is full-width

- **WHEN** the gallery has no assets
- **THEN** the empty-state UI spans the filmstrip scrollport width (not a collapsed virtualizer slot)

### Requirement: Progressive reveal keeps up with filmstrip scroll

While the filmstrip spacer represents the full gallery width and windowing limits DOM, progressive reveal MUST NOT lag behind `scrollLeft` such that mid-scroll shows a dead zone of unrevealed content that should already be in range.

#### Scenario: Mid-scroll reveal has no dead zone

- **WHEN** more gallery items remain and the user scrolls the filmstrip to a mid position during or after progressive import reveal
- **THEN** content that should be in the scrolled window is revealed without a large empty dead zone

### Requirement: Progressive import pacing stays within frame budget

Progressive mid-import filmstrip mounts MUST use pacing that keeps interaction within frame-budget gates (gallery flush / reveal / thumb publish). The system MUST NOT re-freeze the gallery id list solely to pass LoAF.

#### Scenario: Mid-import scroll stays interactive without freezing ids

- **WHEN** a multi-file import is in progress and the user scrolls the filmstrip
- **THEN** newly enqueued ids continue to appear under frame-budget pacing without freezing the gallery id list as the LoAF strategy

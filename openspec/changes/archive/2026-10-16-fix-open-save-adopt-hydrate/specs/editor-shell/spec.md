## ADDED Requirements

### Requirement: Adopt in-memory book into open library

When a library is open and no library-backed book id is active yet, the system SHALL adopt the current in-memory editor book into that library (persist it and mark it active) without clearing gallery or placements. Create/open library MUST leave a path to Save without requiring a destructive empty-book create. Save and Ctrl/Cmd+S MUST be available whenever a library is open (adopting first when needed).

#### Scenario: Save after create library keeps session work

- **WHEN** the user has imported or edited a session-only book, creates or opens a library, and saves without creating a new empty book
- **THEN** the in-memory gallery and placements become the active library-backed book and persist under that book id

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

### Requirement: Durable hashed previews after save and reload

After a durable save of hashed assets, a reload that restores the book MUST show filmstrip thumbnails and placed-frame previews from the derived cache without photo-folder reattachment. Session aspect used for cover crop MUST be restored from hydrated preview dimensions when session meta was cleared by restore.

#### Scenario: Reload shows thumbs and placed frames

- **WHEN** the user saves a library-backed book whose assets have `contentHash` and derived-cache preview bytes, then reloads with a granted library handle
- **THEN** filmstrip thumbnails and placed frames show images rather than empty placeholders

#### Scenario: Landscape crop not square-forced after reload

- **WHEN** a landscape photo was placed before save and the book is restored after reload
- **THEN** the placed preview uses a non-square cover crop consistent with the photo’s aspect

## MODIFIED Requirements

### Requirement: Create or open a library folder

The system SHALL let the user create or open a library folder via a directory picker when File System Access is available, and MUST provide a test seam so automated tests can attach a library without a real picker. With no library open, chrome MUST offer create/open actions. Opening or creating MUST remember the library handle in session state for later restore. After a successful create or open with no active book id, the system MUST adopt the current in-memory book so Save can persist it without a destructive empty-book create. The shell MUST remain viewport-contained (no page-level H/V scroll; filmstrip and pasteboard stay the named scrollports).

#### Scenario: Empty chrome offers library actions

- **WHEN** the user opens the app with no library open
- **THEN** create-library and open-library actions are visible and the filmstrip and pasteboard remain the only scrollports

#### Scenario: Open library via test seam

- **WHEN** a test attaches a library through the provided seam
- **THEN** the shell treats a library as open and exposes create-book / save actions appropriate to that state

#### Scenario: Create library adopts in-memory book

- **WHEN** the user creates or opens a library while an in-memory book is already in the editor and no book id is active
- **THEN** that book becomes the active library-backed book without clearing gallery or placements

### Requirement: Hashed previews rehydrate after restore

After restore, thumbnail and placed-frame previews MUST rehydrate from the derived cache when asset `contentHash` values are present. When a zoom-tier entry is missing but a thumbnail derivative exists for the same hash, the system MUST use that derivative so placed frames are not left empty solely because a tier preset was never written. Reattaching live photo-folder originals is out of scope for this capability.

#### Scenario: Hashed previews rehydrate after restore

- **WHEN** a restored book’s assets include `contentHash` values and derived-cache entries exist for those hashes
- **THEN** filmstrip thumbnails (and zoom tiers when requested) hydrate without requiring photo-folder reattachment

#### Scenario: Thumb derivative fills placed frame when tier missing

- **WHEN** a restored placed asset has a `contentHash`, a thumbnail derived-cache entry exists, and the requested zoom-tier entry is missing
- **THEN** the placed frame still shows a preview image from the thumbnail derivative

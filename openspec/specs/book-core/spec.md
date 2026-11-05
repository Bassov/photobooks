# book-core Specification

## Purpose

Defines the pure book document model: schema versioning, parse/serialize boundaries, referential invariants, and structural-sharing updates used by later editor and layout features.

## Requirements

### Requirement: Book document schema v1

The system SHALL represent a photobook as a pure, serializable document with integer `schemaVersion` 4, an optional book `title` string (may be empty when present), book settings (trim size in mm, bleed, safe margin), a book-level layout grid (margins, columns, rows, gutters in mm), book-level guides, an assets map keyed by asset id, an ordered gallery of unique asset ids, and an ordered list of spreads. Each spread SHALL contain frames (rect in mm, z-order, optional asset id, optional crop) and MAY override layout grid and guides. Crop SHALL be `{ zoom ≥ 1, center: { x, y } }` in normalized source coordinates. A frame MAY carry `fit` (`fill` | `fit`; absent = fill/cover). Asset identity SHALL be the map key (values carry no duplicate id field). Each asset value SHALL be an asset record (see Asset record fields and Asset metadata fields). Assets SHALL be referenced by id only (no File, Blob, or handles). The document SHALL NOT store a separate `pages` collection.

#### Scenario: Minimal valid book parses

- **WHEN** a JSON document matching the current schema with empty gallery, omitted `title`, and at least one spread is parsed
- **THEN** the system returns a typed book document with `schemaVersion` 4 and no invented `title`

#### Scenario: Frame crop shape

- **WHEN** a frame includes crop data
- **THEN** zoom is at least 1 and center coordinates are finite numbers in normalized source space

#### Scenario: Book title retained

- **WHEN** a document includes a non-empty `title` string
- **THEN** parse accepts the document and retains that `title`

### Requirement: Parse and serialize round-trip

The system SHALL parse unknown input into a book document (or a typed failure) and SHALL serialize a valid book to JSON-compatible plain data. Serialize then parse of a valid book MUST be lossless for document fields.

#### Scenario: Lossless round-trip

- **WHEN** a valid book is serialized and then parsed
- **THEN** the resulting book equals the original for all document fields

### Requirement: Schema version gate and migrations

The system SHALL refuse documents whose `schemaVersion` is greater than the supported version. The system SHALL provide a pure migration chain that upgrades supported older versions up to the current version before Zod validation of the current shape. Migrating schemaVersion 1 to 2 SHALL set `schemaVersion` to 2 and replace each asset value with an empty asset record (`{}`), without inventing source root, relative path, size, mtime, or hash. Migrating schemaVersion 2 to 3 SHALL set `schemaVersion` to 3 and set `title` to `""` when `title` is absent or not a string, without inventing asset metadata, orientation, capture time, color space, mime, or `meta` (including GPS). Non-asset fields other than the added `title` default SHALL be preserved. A schemaVersion 1 document SHALL migrate through 2, 3, then 4 to the current version (3 → 4 is specified under Frame rotation, lock and photo rotation fields).

#### Scenario: Newer schema rejected

- **WHEN** input declares `schemaVersion` greater than the supported version
- **THEN** parse fails with a typed newer-schema failure (no silent field stripping)

#### Scenario: Current version migrates

- **WHEN** input declares the current `schemaVersion` and otherwise valid shape
- **THEN** migration succeeds and parse yields a book at the current version

#### Scenario: v1 empty assets migrate without invented identity

- **WHEN** a valid schemaVersion 1 document with asset values `{}` is migrated
- **THEN** the result has `schemaVersion` 4, each asset is an empty record with no source root, relative path, size, mtime, hash, or metadata fields, `title` is `""`, and other pre-existing document fields are unchanged

#### Scenario: v2 book migrates with empty title and preserved identity

- **WHEN** a valid schemaVersion 2 document with identity-filled assets and no `title` is migrated
- **THEN** the result has `schemaVersion` 4, `title` is `""`, identity fields on assets are preserved, and no metadata or GPS fields are invented

### Requirement: Asset record fields

Each asset map value SHALL be a record that MAY include `sourceRootId` (non-empty string), `relativePath` (non-empty string), `byteSize` (non-negative integer), `mtimeMs` (finite number), and `contentHash` (64-character lowercase hexadecimal SHA-256 digest). All five fields are optional. When present, values MUST satisfy those constraints. The record MUST NOT include File, Blob, or filesystem handles.

#### Scenario: Full asset record parses

- **WHEN** an asset value includes valid `sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`, and a 64-character lowercase hex `contentHash`
- **THEN** parse accepts the document and retains those fields

#### Scenario: Empty asset record parses

- **WHEN** an asset value is `{}`
- **THEN** parse accepts the document

#### Scenario: Negative byte size rejected

- **WHEN** an asset value has `byteSize` less than 0
- **THEN** parse fails

#### Scenario: Empty string identity field rejected

- **WHEN** an asset value has `sourceRootId`, `relativePath`, or `contentHash` equal to `""`
- **THEN** parse fails

#### Scenario: Non-SHA-256 contentHash rejected

- **WHEN** an asset value has `contentHash` that is not a 64-character lowercase hexadecimal string
- **THEN** parse fails

### Requirement: Referential invariants at parse

After successful shape validation, the system SHALL reject documents that violate: (1) every frame `assetId` exists in `assets`; (2) every placed `assetId` appears in `gallery`; (3) every gallery id exists in `assets`; (4) gallery ids are unique.

#### Scenario: Dangling frame asset rejected

- **WHEN** a frame references an asset id absent from `assets`
- **THEN** parse fails

#### Scenario: Placed asset missing from gallery rejected

- **WHEN** a frame references an asset present in `assets` but absent from `gallery`
- **THEN** parse fails

#### Scenario: Duplicate gallery id rejected

- **WHEN** `gallery` contains the same asset id more than once
- **THEN** parse fails

### Requirement: Structural-sharing updates

The system SHALL expose pure immutable update helpers for spread and frame changes such that when a helper leaves a spread's content unchanged, that spread object identity is preserved on the returned book; when only one spread changes, other spread identities remain unchanged.

#### Scenario: Unrelated spreads keep identity

- **WHEN** an update changes frames on one spread
- **THEN** other spreads in the returned book are reference-equal to the input book's corresponding spreads

#### Scenario: No-op update keeps book identity

- **WHEN** an update produces the same spread content as before
- **THEN** the returned book is reference-equal to the input book (or at least the unchanged spreads and the book root when no fields changed)

### Requirement: Core module purity

`src/core` SHALL NOT import React, DOM APIs, or UI/platform modules (`src/photo`, `src/perf`, `src/App`). Dependency cruiser SHALL enforce a `core-is-pure` rule.

#### Scenario: Dependency gate

- **WHEN** `pnpm deps` runs on a tree where `src/core` imports React
- **THEN** the `core-is-pure` rule fails

### Requirement: Asset metadata fields

Each asset map value MAY include optional metadata fields. When present, `widthPx`/`heightPx` MUST be positive integers, `orientation` MUST be an integer 1..8, `capturedAt`/`colorSpace`/`iccProfileName`/`mime` MUST be non-empty strings, and `meta` MUST use non-empty strings for `title`/`caption`/`camera`/`lens`/`keywords` entries and finite `{ lat, lon }` for `gps`.

#### Scenario: Full metadata asset parses

- **WHEN** an asset value includes valid `widthPx`, `heightPx`, `orientation` (1..8), `capturedAt`, `colorSpace`, `iccProfileName`, `mime`, and `meta` with non-empty `title`, `caption`, `camera`, `lens`, `keywords` strings, and finite `gps` `{ lat, lon }`
- **THEN** parse accepts the document and retains those fields

#### Scenario: Invalid orientation rejected

- **WHEN** an asset value has `orientation` outside 1..8
- **THEN** parse fails

#### Scenario: Non-positive pixel size rejected

- **WHEN** an asset value has `widthPx` or `heightPx` less than 1
- **THEN** parse fails

#### Scenario: Empty capturedAt rejected

- **WHEN** an asset value has `capturedAt` equal to `""`
- **THEN** parse fails

#### Scenario: Empty meta string field rejected

- **WHEN** an asset `meta.title`, `meta.caption`, `meta.camera`, `meta.lens`, or a `meta.keywords` entry equals `""`
- **THEN** parse fails

### Requirement: GPS storage and export policy

The system SHALL store asset `meta.gps` only when the user has opted in to keep location for that library or asset. Site export MUST omit GPS coordinates from any exported package or published payload so that location never leaves the library via site export. This requirement defines policy for writers and exporters; absence of `meta.gps` remains valid.

#### Scenario: Document without GPS remains valid

- **WHEN** an asset `meta` object omits `gps`
- **THEN** parse accepts the document

#### Scenario: Opt-in GPS retained in library document

- **WHEN** an asset includes valid `meta.gps` after user opt-in
- **THEN** parse accepts the document and retains those coordinates in the library document

### Requirement: Book summary title

Library book summaries SHALL include `id` and `title`, where `title` is the book document's `title` string (empty when the document title is empty or when the stored book cannot be parsed for listing).

#### Scenario: Listed summary carries title

- **WHEN** a stored book has `title` `"Summer"` and books are listed
- **THEN** the summary for that book includes `title` `"Summer"`

### Requirement: Duplicate spread

The system SHALL provide a `duplicateSpread` op (`BookOp` `duplicateSpread`) that inserts a copy of a spread right after the source with a fresh (or given) id, the same template and cloned frames, and re-applies templates to spreads whose page count changed. An unknown spread id MUST return the same book.

#### Scenario: Copy follows the source

- **WHEN** spread `a` of `[a, b]` is duplicated
- **THEN** the spreads are `[a, copy, b]`, `copy` has `a`'s frames, and `a` keeps its identity

### Requirement: Remove spread re-flows page roles

`removeSpread` SHALL re-apply templates to spreads whose page count changed because of the removal (e.g. the new last spread becomes single-page).

#### Scenario: Removing the last spread

- **WHEN** the last spread of a book is removed
- **THEN** the new last spread is laid out for its single-page role

### Requirement: Move spread re-lays changed page roles

`moveSpread` SHALL reapply the template of every spread whose page count changes because of the move (first and last spreads are single-page), keeping its photos.

#### Scenario: First spread moved to the middle

- **WHEN** the first spread is moved to the middle of the book
- **THEN** it becomes a two-page spread laid out with its template and keeps its photos

### Requirement: Layout grid settings

The book layout grid (margins top / bottom / inside / outside, columns, rows, column and row gutters) SHALL be editable at book level, and a spread MAY override single fields. Columns and rows MUST clamp to 1–12; margins and gutters MUST be ≥ 0. A spread override stores only the fields it changes; resetting removes it, and `resetSpreadGridFields` removes only the listed fields (the whole override when none is left). A grid edit MUST be one history step (undoable) and MUST re-align, keeping placements, only templated spreads whose effective grid reads a changed field from the edited level: a book edit the spreads where that field's source is `book`; a master edit the spreads using that master that do not override it; a spread edit, reset or parent change that spread. Deleting a parent and setting the book default parent (`setDefaultParent`: a parent id or `null` for none; an unknown id or the current default leaves the book) MUST each be one history step that re-aligns exactly the templated spreads whose resolved margins or gutters change; spread overrides keep their values and other spreads keep their objects.

#### Scenario: Override one field and reset

- **WHEN** a spread overrides columns to 5 and the book grid has 2
- **THEN** that spread resolves 5 columns, others 2, and reset restores the book value

#### Scenario: Master gutter re-aligns its spreads

- **WHEN** Master A is used by three templated spreads, one of them overriding the column gutter, a fourth spread uses Master B, and Master A's column gutter changes
- **THEN** the two inheriting spreads' frames move in one history step, the overriding and Master B spreads keep their frames, and placements stay

#### Scenario: Deleting a gridded master re-aligns its spreads

- **WHEN** Master A (the book default, with its own column gutter) is used by two templated spreads and Master B by a third, and Master A is deleted
- **THEN** the two spreads' frames move to the book grid in one history step and the Master B spread keeps its object

### Requirement: Layout grid editing UI

The spread Inspector SHALL offer a Grid section (summary `columns×rows`, a `Use master` / `Use book` (no parent) or `Custom` switch, a Show grid switch for the editor-only overlay); the book grid has no Inspector section. `Use master` SHALL show a one-line summary and reset every spread override (one step). `Custom` SHALL show the eight fields in the master field look (C R / G RG, Margins + link, T B / I O): a field the spread does not override reads grey 400, an overridden field dark 600 with a ↺ button that removes that field (all four margins while linked) as one 'Reset grid value' step; each field's book / master / spread source MUST be in its `title` and accessible description, and the hint MUST read "Grey values follow <parent>." or "Grey values follow the book grid.". Resetting the last override SHALL keep Custom open until the spread changes. Turning the margin link on SHALL write only the margins that differ from Top. The overlay MUST NOT appear in thumbnails or output.

#### Scenario: Spread override label

- **WHEN** the user sets the Gutter on a spread using Master A and then presses its ↺
- **THEN** the Gutter reads dark 600 with ↺ and the source "set on this spread", then returns to the Master A value in grey while Custom stays selected

### Requirement: Frame rotation, lock and photo rotation fields

A frame MAY carry `rotationDeg` (number, degrees about its center; absent = 0) and `locked` (boolean; absent = unlocked). A frame crop MAY carry `quarterTurns` (integer 0–3 clockwise; absent = 0) and `straightenDeg` (number in [-45, 45]; absent = 0). Migrating schemaVersion 3 to 4 SHALL set `schemaVersion` to 4 and set `rotationDeg` to 0 on frames lacking it, without setting `locked` or crop rotation.

#### Scenario: v3 book migrates

- **WHEN** a valid schemaVersion 3 document is migrated
- **THEN** the result has `schemaVersion` 4, every frame has `rotationDeg` 0 and no `locked`, and the document parses as the current shape

### Requirement: Spread master and background

Applying a parent to a spread SHALL store `parentId` (a parent id, or `null` for None) only when it differs from what an absent field resolves to (the book default, else None); otherwise the field SHALL be removed. An unknown parent id or the spread's current parent MUST leave the book unchanged; a stored `masterId` (the former Master A / B switch) is dropped at load. A spread MAY store `backgroundColor` (sRGB hex; absent means the book page colour); clearing the colour SHALL remove the field. Each change MUST be one history step touching only that spread. The resolved spread SHALL list the applied parent's frames (minus hidden / overridden, plus local copies) first, flagged as parent items, then the spread's own frames in stored order; canvas, spread list and presentation SHALL paint parent items beneath every spread frame, and they MUST NOT be selectable, draggable or drop targets.

#### Scenario: Parent round-trip

- **WHEN** a book without a default parent applies parent P to spread 1, then None, then P again
- **THEN** spread 1 stores `P`, then no `parentId`, then `P`, and other spreads are unchanged

#### Scenario: Parent items paint beneath

- **WHEN** parent P has one frame with `z` 99 and spread 1 (one frame, `z` 1) uses P
- **THEN** the resolved spread lists P's frame first as a parent item, and the canvas paints it below the spread frame and selects nothing when it is clicked

### Requirement: Cover text and book size readouts match the kit

A new book's cover text SHALL be its title on the front, spine and back; the canvas SHALL draw the back text bottom-left on the back panel. The page count SHALL be the pages the Spreads list shows: a single page 1, two pages per inner spread and a single last page (2 × (spreads − 1); 0 or 1 below two spreads); the top bar, Book settings, library caption, spine and site meta SHALL all use it. Spine width SHALL be computed by the book's print profile (generic: 8 mm + 0.2 mm per page, the page count clamped to the profile's 20–120 first), not stored; the Cover inspector SHALL show it as read-only text "`N` mm", and the canvas spine and the cover card SHALL use it (a stored `spineWidthMm` is used only when the cover's spine source is `manual` and the profile allows a manual override). Book settings SHALL show Pages as an editable number box (no spin arrows) with the range hint "20–120": a committed value (Enter or blur) SHALL round to the nearest even number, clamp to 20–120 and add empty spreads at the end or remove the last spreads until the page count equals it, as one undo step. The note SHALL read "Add N spread(s) to reach the 20-page minimum" below 20, "Remove N spreads to stay within 120 pages" above 120, else "Pages are added in spreads of 2"; the subtitle SHALL read "`back || front || Untitled book` · applies to the whole book".

#### Scenario: New book

- **WHEN** a book "Lake trip" with 3 spreads is created
- **THEN** the back text field and canvas read "Lake trip", Spine width reads "12 mm", and Pages shows "4" · "20–120" with "Add 8 spreads to reach the 20-page minimum"

#### Scenario: Typed page count

- **WHEN** Pages is set to 10, then 200, then 33
- **THEN** the book has 11, then 61, then 18 spreads, Pages shows 20, 120, 34, the Spreads list ends at that page, and Spine width reads 12, 32, 14.8 mm

### Requirement: Parent spreads

Schema version 10 SHALL let a book store `parents` (each with id, name, shared frames, guides, an optional partial layout grid and optional page-number items), an optional `defaultParentId` and optional `pageNumbering` (`start` ≥ 0, `skipFirst`, `format` `decimal` | `lower-roman` | `upper-roman`). A spread MAY store `parentId` (absent → the book default; `null` → None) and `parentOverrides` (hidden parent frame / guide ids, local frame / guide copies carrying the `overridesId` they replace). Migrating schemaVersion 9 to 10 SHALL only set `schemaVersion` to 10. The pure resolver SHALL return the grid book → parent → spread (None or an unknown id → the book grid), parent guides minus hidden / overridden then local copies then spread guides, and parent frames minus hidden / overridden, then local copies, then spread frames on top.

#### Scenario: v9 book loads unchanged

- **WHEN** any valid schemaVersion 9 document is migrated and parsed
- **THEN** it equals the input with `schemaVersion` 10 and no other field changed

#### Scenario: Hidden and overridden parent items never resolve

- **WHEN** a spread hides one parent frame and overrides another
- **THEN** neither parent original is resolved, the local copy is, and every spread frame paints above every parent-layer frame

### Requirement: Parent spread editing

The book SHALL support creating a parent (id unused by any spread or parent, name "Master `<next free letter>`", no items), renaming it (trimmed, non-empty; else unchanged) and deleting it; deleting SHALL set `parentId` to `null` on spreads that stored its id, so those spreads resolve to None. Every new book and every book opened from the library SHALL have a default parent: without a known `defaultParentId` an empty parent is added and set as the default (no stored `parentId` changes); deleting the default parent and clearing the default while parents exist MUST leave the book unchanged, and Make default sets `defaultParentId` (spreads without a stored `parentId` follow it). Every spread item op addressed to a parent id SHALL edit that parent's items exactly as it edits a spread's, and the parent SHALL resolve and paint as a two-page spread. Each create / rename / delete / item edit MUST be one history step and MUST notify only the parent and the spreads that resolve to it. The editor's Masters mode SHALL list the book's parents (thumb + name, a "Default" tag on the default, New master, Make default on the others, Rename, Delete disabled on the default) under a note naming the default, and show the selected parent on the canvas, where its items are added, moved and resized like spread items; the Masters list scrolls inside its panel only. The master canvas SHALL show the parent's `guides` like spread guides, show the rulers while rulers are on, and add / move / remove guides in `parent.guides` exactly as on a spread (ruler drag adds, release commits one history step, drop on its ruler removes).

#### Scenario: Delete falls back to None

- **WHEN** Master A is the book default, spread 2 stores `parentId` Master B, and Master B is deleted, then Master A
- **THEN** Master B is removed and spread 2 resolves to None; deleting Master A leaves the book unchanged

#### Scenario: A new book has Master A as default

- **WHEN** a new book is created, then Master B is added and made the default
- **THEN** the book first has one empty parent "Master A" as `defaultParentId` used by every spread, then every spread without a stored `parentId` resolves to Master B

#### Scenario: Move once, every spread updates

- **WHEN** every spread uses parent P and P's logo is moved once in Masters mode
- **THEN** the logo's rect changes in P only, and every spread resolves the logo at the new rect

#### Scenario: Ruler guide on a master

- **WHEN** rulers are on in Masters mode and a guide is dragged from the top ruler onto Master A, then moved, then undone
- **THEN** Master A's `guides` hold one horizontal guide at the dropped offset, the move is one history step that undo reverts, and no spread's own `guides` change

### Requirement: Parent overrides ops

A spread SHALL override a resolved parent frame or guide (`overrideParentFrame` / `overrideParentGuide`: a copy with a new id and `overridesId` in `parentOverrides`), hide one (`hideParentItem`: removes its copy, adds the id to `hiddenIds`), reset one (`resetParentItem`: removes copy and hidden id) or reset all (`resetSpreadToParent`: removes `parentOverrides`); empty override lists are dropped, so override then reset restores the spread. Every frame op addressed by spread and frame id (move, resize, rotate, rect, photo, swap, crop, fit, caption, adjust, style, lock) SHALL also edit a copy, which keeps its `overridesId` and never detaches the template; later parent edits never touch a copy. `removeFrames` SHALL remove a listed copy and hide its parent item in the same step. Changing the parent a spread resolves to (set, delete, new book default) SHALL keep the work in the same history step: copies become own frames below the lowest own z in their order without `overridesId`, copy guides become own guides, hidden ids are dropped. Each op MUST be one history step and MUST notify only its spread; a parent edit MUST NOT notify a spread whose painted parent frames are unchanged.

#### Scenario: Override, then switch master

- **WHEN** spread 2 overrides Master A's logo, moves the copy, and then switches to Master B
- **THEN** the moved logo is an own frame of spread 2 under its other frames, without `overridesId`, and one undo restores the copy and Master A

### Requirement: Master inspector and inherited grid

In Masters mode the Inspector SHALL show, for the shown parent, a head (parent name; for the default "Default · all N pages" / "Default · U of N pages" / "Default · no pages" over all book pages, else "Used by N pages" / "Used by 1 page" / "Not used yet", counting the pages of every spread that resolves to it; a non-default parent shows a "Make default" button, plus a hint when unused) and a GRID section (Columns, Rows, Gutter, Row gap, margins T / B / I / O with a link toggle). A committed field MUST write one `setSpreadGrid` patch to the parent (one history step); while linked, a margin edit writes all four margins. A frame selected on the master SHALL show the spread frame inspector; Esc or an empty click on the master canvas returns to the master inspector; with no parents the Inspector SHALL show "Create a master with New master to set its grid.". The master canvas SHALL always draw the parent's grid (outside Preview) and its name below the spread. The effective grid of a spread SHALL be book → parent → spread, a field set only by the parent reporting source `master`; a parent grid edit MUST re-render only the parent and the spreads resolving to it.

#### Scenario: Master grid reaches its spreads

- **WHEN** Master A is used by every spread but one (None) and its Columns is set to 5
- **THEN** the master canvas shows 5 columns per page, every Master A spread resolves 5 columns, and the None spread keeps the book grid

### Requirement: Print profile reference

Schema version 11 SHALL let a book store `printProfile` (`id` non-empty, `overrides` with optional `trimMinMm`, `trimMaxMm`, `bleedMinMm`, `bleedMaxMm`) and a cover MAY store `print.spineWidthSource` (`profile` | `manual`); absent → the built-in `generic` profile with no overrides and `profile`. Migrating schemaVersion 10 to 11 SHALL add `printProfile` `{ id: "generic", overrides: {} }` and `cover.print` `{ spineWidthSource: "profile" }` and change no other field.

#### Scenario: v10 document gains the default profile

- **WHEN** any valid schemaVersion 10 document is migrated and parsed
- **THEN** it equals the input with `schemaVersion` 11, the default `printProfile` and `cover.print`, and no other field changed

### Requirement: Print profile validates trim and bleed

Trim and bleed SHALL stay user values. A pure validator SHALL report each trim edge or bleed outside the effective profile (built-in values, then overrides) and an unknown profile id, and SHALL never change the book.

#### Scenario: Bleed above the profile

- **WHEN** a book's bleed is above the effective profile's `bleedMaxMm`
- **THEN** the validator returns a bleed issue with the value and the allowed range, and the book is unchanged

### Requirement: Printer profile data

A printer profile SHALL parse with Zod and carry trim and page-bleed ranges, cover bleed, cover wrap and hinge widths, safe margin, page count `{min, step, max}` (`max - min` a multiple of `step`), single first page, printed endpapers, spine (`formula` base + per page, or a `table` ascending by page count; manual override allowed or not), `output` `pages` | `spreads`, crop marks (default off), color space `srgb`, file limits, DPI `warn` ≥ `min`, and minimum font size. Low-DPI checks SHALL use the book's effective profile thresholds; the built-in `generic` profile and an unknown profile id use 200 / 150. The `generic` profile SHALL have wrap 15 mm, hinge 8 mm and spine `8 + 0.2 mm/page`. A pure cover geometry SHALL take the spine from the profile rule at the page count clamped to the profile range (formula rounded to 0.1 mm; table: first row covering the count, else the last row) and SHALL give the printed cover sheet `(2 × trim width + spine + 2 × wrap) × (trim height + 2 × wrap)` with the back, spine, front, hinge and safe-frame rects; an unknown profile id uses `generic`.

#### Scenario: Profile thresholds drive the low-DPI level

- **WHEN** a frame's effective DPI is 180 and the profile's DPI is `{ warn: 200, min: 150 }`
- **THEN** the frame reports `warn`, and with `{ warn: 300, min: 200 }` it reports `min`

#### Scenario: Generic cover sheet

- **WHEN** a 19 × 23 cm book with 20 pages uses the `generic` profile
- **THEN** the spine is 12 mm and the cover sheet is 422 × 260 mm (32 mm spine, 442 mm wide at 120 pages)

### Requirement: Parent guides on child spreads

While guides are shown, every book spread SHALL show the guides of its resolved parent read-only, under its own guides (order parent → local copies → own), as dashed 1 px `--parent-soft` lines with the own guides' 24 px overhang, pointer-transparent (a press reaches what is under the line), and absent from thumbs, Preview and exports. Parent guides are in two-page mm: on the first single page (right) a vertical guide `v ≥ trim width` SHALL show at `v − trim width`, on the last single page (left) only `v ≤ trim width` shows; a mapped vertical outside the spread width SHALL NOT show; horizontals show unchanged. The Masters canvas SHALL keep showing the parent's guides as editable own guides. A parent edit that changes only its guides MUST NOT repaint child spreads.

#### Scenario: Master guide on every child spread

- **WHEN** a guide is added on Master A and Pages is shown
- **THEN** every spread using Master A shows one dashed parent line at the guide's mm, a None spread shows none, and a press on the line over a frame selects that frame

# pasteboard Specification

## Purpose

Editor pasteboard workspace: spread stack, template/add-spread, camera zoom, and place/replace/swap/move/unplace (pointer and keyboard) with scrollport containment. Shell/library/home lives in `editor-shell`; gallery filmstrip in `filmstrip`.

## Requirements

### Requirement: Workspace hosts the pasteboard

When the editor surface is active, the workspace SHALL show the book's pasteboard and MUST NOT show a placeholder sentence in its place.

#### Scenario: Workspace is not a placeholder

- **WHEN** the editor surface is active
- **THEN** the workspace shows the pasteboard

### Requirement: Active spread template and add spread

The editor SHALL offer keyboard-reachable controls to set the active spread’s template (full-bleed, one-per-page, 2-up, 4-grid) and to append a spread. The template control MUST show the active spread’s current template. The template control’s accessible name MUST state that it applies to the active spread. The appended spread MUST use the template of the spread that was active when Add spread was pressed, or one-per-page when none is active, and MUST enter the pasteboard scrollport after layout (including after fit when one axis still overflows). Appending a spread MUST keep the committed zoom and the previous spread’s scale. Controls MUST NOT create page-level H/V scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread while the active spread uses a catalog template
- **THEN** the pasteboard spread count increases by one, the new spread uses that same template, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread with no active spread uses one-per-page

- **WHEN** the user adds a spread and no spread is active
- **THEN** the new spread uses one-per-page

#### Scenario: Add spread keeps fitted zoom and contains after fit

- **WHEN** the user adds a spread after fit (including narrow viewport or mid-scroll desktop)
- **THEN** zoom and previous-spread scale hold, the new spread is in the pasteboard port, and the document has no page scroll

### Requirement: Camera zoom controls

Keyboard-reachable fit spread, fit width, and 100% physical size (96 CSS px/inch) plus a percent indicator. Controls MUST NOT create page-level H/V scroll.

#### Scenario: Fit and 100%

- **WHEN** the user chooses 100%, fit width, or fit spread
- **THEN** sizing matches physical size / port width / port fit respectively and the document has no page scroll

### Requirement: Place and replace from the gallery

Place or replace a frame photo by dragging from the filmstrip onto a frame (empty → place, filled → replace). One document operation per drop. Photo remains in the filmstrip with Placed badge updates. There MUST NOT be a Replace button, photo-picker modal, or click-to-place/replace from gallery selection on the frame control. Empty gallery: no Placed/Unplace; empty frames stay “Place photo” placeholders (move/swap labels only when a move source is armed). Place/replace MUST NOT create page-level H/V scroll (H in filmstrip, V in pasteboard).

#### Scenario: Place, replace, empty gallery

- **WHEN** a photo is placed or replaced via filmstrip drag, or a frame is activated with an empty gallery / no move source
- **THEN** frames and Placed badges match the requirement, no Replace control is present, and the document stays contained

### Requirement: Swap, move, and unplace

Drop filled→filled swaps (including across spreads); filled→empty moves; drop on self is a no-op; drop on filmstrip unplaces. One operation per accepted drop; photos stay in the filmstrip; Placed clears when no placements remain. Keyboard (no gallery click-place): mark move source, swap/move by activating another frame, or Unplace. Escape clears move source and gallery selection. Delete/Backspace unplaces focused filled frame (ignored in text fields). Unplace keeps focus on emptied frame and announces; live region follows select/swap/move. Move source MUST clear when its frame is missing/empty; Unplace control stays in filmstrip but unavailable without a source. Frame drag unplace/swap only for same-document matching payload. Pressed move source shows a visible outline (including when zoomed out). Swap/move/unplace MUST NOT create page-level H/V scroll.

#### Scenario: Pointer and keyboard rearrange

- **WHEN** the user swaps, moves, or unplaces via pointer or keyboard (including Escape, Delete, cancel source)
- **THEN** placements, badges, focus, announcements, and containment match the requirement

### Requirement: Editor hard-no chrome selection and cursors

Filmstrip, template strip, and spreads-list selection SHALL use tone fill `#CACACA` only (no black ring-select, no blue chrome). Black outline is reserved for canvas frame selection + handles (and primary Create elsewhere). Used-photo filmstrip badges SHALL use black/ink styling. While Space is held for pan, panel hotkeys MUST NOT fire; canvas MUST set `data-panning` and suppress its focus ring. Wheel over the pasteboard SHALL zoom to the pointer (Ctrl/Cmd optional). Tool cursors for shipped tools: select = default arrow; Space/hand pan = grab (outlined kit cursors when those tools exist).

#### Scenario: Tone selection and Space pan

- **WHEN** the user selects a filmstrip thumb or spread list item, or holds Space over the canvas
- **THEN** selection is tone-only `#CACACA`, panel hotkeys do not toggle while Space is held, and the canvas focus ring is suppressed while `data-panning` is set

### Requirement: Smaller template announces unplaced photos

When a template change removes placements, the polite live region MUST read `1 photo was unplaced from the spread` or `N photos were unplaced from the spread`. Removed photos stay in the gallery. No removals MUST leave the live region unchanged. Empty gallery template change: no Placed badge; live region stays empty. Smaller template MUST NOT create page scroll.

#### Scenario: Overflow placements announced

- **WHEN** a filled spread switches to a template with fewer slots
- **THEN** overflow photos leave the spread but stay in the gallery, badges update, and the live region reports the removal count

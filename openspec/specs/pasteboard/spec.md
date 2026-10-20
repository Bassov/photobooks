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

The editor SHALL offer keyboard-reachable controls to set the active spread’s template (full-bleed, one-per-page, 2-up, 4-grid) and to append a spread. Template control shows the current template. Appended spread uses one-per-page, enters the pasteboard scrollport after layout (including after fit when one axis still overflows), and keeps committed zoom and previous spread scale. Controls MUST NOT create page-level H/V scroll.

#### Scenario: Switch template and add spread

- **WHEN** the user chooses 4-grid or adds a spread (including after fit on narrow or mid-scroll desktop)
- **THEN** frame counts update only on the active/new spread, the new spread is in the pasteboard port, zoom/scale hold, and the document has no page scroll

### Requirement: Camera zoom controls

Keyboard-reachable fit spread, fit width, and 100% physical size (96 CSS px/inch) plus a percent indicator. Controls MUST NOT create page-level H/V scroll.

#### Scenario: Fit and 100%

- **WHEN** the user chooses 100%, fit width, or fit spread
- **THEN** sizing matches physical size / port width / port fit respectively and the document has no page scroll

### Requirement: Place and replace from the gallery

Place a selected gallery photo into an empty frame or replace a filled frame (drop or keyboard). One document operation per action. Photo remains in the filmstrip with Placed badge updates. With no selection, keyboard frame activation is a no-op. Empty gallery: no Placed/Unplace; frames stay “Place photo” placeholders. Place/replace MUST NOT create page-level H/V scroll (H in filmstrip, V in pasteboard).

#### Scenario: Place, replace, empty gallery

- **WHEN** a photo is placed or replaced, or a frame is activated with an empty gallery / no selection
- **THEN** frames and Placed badges match the requirement and the document stays contained

### Requirement: Swap, move, and unplace

Drop filled→filled swaps (including across spreads); filled→empty moves; drop on self is a no-op; drop on filmstrip unplaces. One operation per accepted drop; photos stay in the filmstrip; Placed clears when no placements remain. Keyboard (no gallery selection): mark move source, swap/move by activating another frame, or Unplace; gallery selection still place/replaces and clears move source. Escape clears move source and gallery selection. Delete/Backspace unplaces focused filled frame (ignored in text fields). Unplace keeps focus on emptied frame and announces; live region follows select/swap/move. Move source MUST clear when its frame is missing/empty; Unplace control stays in filmstrip but unavailable without a source. Frame drag unplace/swap only for same-document matching payload. Pressed move source shows a visible outline (including when zoomed out). Swap/move/unplace MUST NOT create page-level H/V scroll.

#### Scenario: Pointer and keyboard rearrange

- **WHEN** the user swaps, moves, or unplaces via pointer or keyboard (including Escape, Delete, cancel source)
- **THEN** placements, badges, focus, announcements, and containment match the requirement

### Requirement: Smaller template announces unplaced photos

When a template change removes placements, the polite live region MUST read `1 photo was unplaced from the spread` or `N photos were unplaced from the spread`. Removed photos stay in the gallery. No removals MUST leave the live region unchanged. Empty gallery template change: no Placed badge; live region stays empty. Smaller template MUST NOT create page scroll.

#### Scenario: Overflow placements announced

- **WHEN** a filled spread switches to a template with fewer slots
- **THEN** overflow photos leave the spread but stay in the gallery, badges update, and the live region reports the removal count

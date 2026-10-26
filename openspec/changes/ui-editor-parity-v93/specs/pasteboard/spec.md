## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Editor hard-no chrome selection and cursors

Filmstrip, template strip, and spreads-list selection SHALL use tone fill `#CACACA` only (no black ring-select, no blue chrome). Black outline is reserved for canvas frame selection + handles (and primary Create elsewhere). Used-photo filmstrip badges SHALL use black/ink styling. While Space is held for pan, panel hotkeys MUST NOT fire; canvas MUST set `data-panning` and suppress its focus ring. Wheel over the pasteboard SHALL zoom to the pointer (Ctrl/Cmd optional). Tool cursors for shipped tools: select = default arrow; Space/hand pan = grab (outlined kit cursors when those tools exist).

#### Scenario: Tone selection and Space pan

- **WHEN** the user selects a filmstrip thumb or spread list item, or holds Space over the canvas
- **THEN** selection is tone-only `#CACACA`, panel hotkeys do not toggle while Space is held, and the canvas focus ring is suppressed while `data-panning` is set

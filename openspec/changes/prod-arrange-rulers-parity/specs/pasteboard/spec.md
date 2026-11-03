## MODIFIED Requirements

### Requirement: Swap, move, and unplace

Drop filled→filled swaps (including across spreads); filled→empty moves; drop on self is a no-op; drop on filmstrip unplaces. One operation per accepted drop; photos stay in the filmstrip; Placed clears when no placements remain. Dragging a filled frame's body, selected or not, SHALL be this photo drag, never a frame move (kit `#/demo` step 17); only empty frames move by their body. While a photo frame is dragged (over the canvas, other frames or the filmstrip) the editor status SHALL paint as the kit status pill "Drag onto another frame to swap, or onto the filmstrip to take the photo back" at the canvas bottom-left (12 px insets, 12 px text, 8 px radius) until the drag ends; the ruler guide status paints as the same pill; other editor statuses stay a live region with no visible chip. Keyboard (no gallery click-place): mark move source, swap/move by activating another frame, or Unplace. Escape clears move source and gallery selection. Delete/Backspace unplaces focused filled frame (ignored in text fields). Unplace keeps focus on emptied frame and announces; live region follows select/swap/move. Move source MUST clear when its frame is missing/empty; Unplace control stays in filmstrip but unavailable without a source. Frame drag unplace/swap only for same-document matching payload. Pressed move source shows a visible outline (including when zoomed out). Swap/move/unplace MUST NOT create page-level H/V scroll.

#### Scenario: Pointer and keyboard rearrange

- **WHEN** the user swaps, moves, or unplaces via pointer or keyboard (including Escape, Delete, cancel source)
- **THEN** placements, badges, focus, announcements, and containment match the requirement

#### Scenario: Drag hint while a selected photo frame is dragged

- **WHEN** the user drops a photo on a frame, clicks it, and drags it over another frame and then the filmstrip
- **THEN** the frame does not move, the hint pill shows bottom-left throughout, and after release on the filmstrip the photo is unplaced and the pill is gone

### Requirement: Editor hard-no chrome selection and cursors

Filmstrip, template strip, and spreads-list selection SHALL use tone fill `#CACACA` only (no black ring-select, no blue chrome). Black outline is reserved for canvas frame selection + handles (and primary Create elsewhere). Used-photo filmstrip badges SHALL use black/ink styling. While Space is held for pan, panel hotkeys MUST NOT fire; canvas MUST set `data-panning` and suppress its focus ring. Wheel over the pasteboard SHALL zoom to the pointer (Ctrl/Cmd optional). Tool cursors for shipped tools: select = default arrow; Space/hand pan = grab (outlined kit cursors when those tools exist). Rulers (kit `viewport.tsx`): the top ruler SHALL show `s-resize` and the left ruler `e-resize`; placing or moving a guide SHALL set the status "Vertical guide at N mm (left page|right page)" (page-local mm, the side from the spread half or a single page's side) or "Horizontal guide at N mm", 0.1 mm rounding.

#### Scenario: Tone selection and Space pan

- **WHEN** the user selects a filmstrip thumb or spread list item, or holds Space over the canvas
- **THEN** selection is tone-only `#CACACA`, panel hotkeys do not toggle while Space is held, and the canvas focus ring is suppressed while `data-panning` is set

#### Scenario: Guide status on a two-page spread

- **WHEN** the user pulls a vertical guide from the left ruler onto the right page of a two-page spread
- **THEN** the status pill reads "Vertical guide at N mm (right page)" with N measured from the right page's left edge

### Requirement: Frame context menu, arrange shortcuts and lock

Right-clicking an editor frame (or Shift+F10 on a focused one) SHALL select it and open a menu with Bring to front, Bring forward, Send backward, Send to back and Lock / Unlock, dispatching the same ops as the inspector Arrange buttons and lock toggle; a move that cannot change the order is hidden, never disabled. The inspector Arrange buttons (single and multi selection) SHALL be named with their shortcut, kit `inspector.tsx`: "Send to back (Shift+Ctrl+[)", "Send backward (Ctrl+[)", "Bring forward (Ctrl+])", "Bring to front (Shift+Ctrl+])"; the menu shows the same shortcut text. Ctrl/Cmd+] / Ctrl/Cmd+[ SHALL bring the selected frame forward / send it backward, with Shift to the front / back, and Ctrl/Cmd+Shift+L SHALL toggle its lock. A locked frame SHALL NOT move, resize, start a photo drag, accept a dropped photo or take part in a click swap as source or target (the status shows the frame-locked message, the selection and both frames stay unchanged, no undo step); unlocking restores all of these. With 2 or more frames selected, right-clicking one of them SHALL keep the selection; the menu, the arrange shortcuts and Lock SHALL act on the whole set (one `reorderFrames` / `setFramesLocked` undo step; Lock locks all when any is unlocked, else unlocks all) and the menu SHALL add "Delete N frames".

#### Scenario: Send behind from the menu

- **WHEN** the user right-clicks the top of two overlapping frames and picks Send to back
- **THEN** the other frame is on top at the overlap and the inspector shows layer 1 for the clicked frame

#### Scenario: Locked frame ignores drag and drop

- **WHEN** a frame is locked and the user drags it or drops a filmstrip photo onto it
- **THEN** its box is unchanged, it shows no resize handles and it stays empty; after Ctrl/Cmd+Shift+L a drag moves it

#### Scenario: Click swap with a locked frame

- **WHEN** a locked filled frame is selected and the user clicks another filled frame (or the other way round)
- **THEN** both photos stay, both frames keep their lock flags, the status shows the frame-locked message and Undo has no new step

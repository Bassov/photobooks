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

The editor SHALL offer keyboard-reachable controls to set the active spread’s template (full-bleed, one-per-page, 2-up, 4-grid) and to add a spread (the spreads-list row menu Add after, or Ctrl/Cmd+Enter on a row). The template control MUST show the active spread’s current template. The template control’s accessible name MUST state that it applies to the active spread. The added spread MUST use the template of the spread that was active when it was added, or one-per-page when none is active, and MUST enter the pasteboard scrollport after layout (including after fit when one axis still overflows). Adding a spread MUST keep the committed zoom and the previous spread’s scale. Controls MUST NOT create page-level H/V scroll.

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

### Requirement: Stack spacing and page labels

The gap between consecutive spreads on the pasteboard (bottom edge to next top edge) SHALL be a fixed fraction of the spread height, 104 / 588 (Owner design change, round 7: wider than the kit `#/demo` 44 / 588 so the page numbers and the new-spread pill have room), at every committed zoom including the smallest reachable zoom, so the gap looks the same relative to the pages. Each page number SHALL sit a constant 8 screen px under its own page's bottom edge with an 11 px font that does not scale with zoom, including during a live zoom gesture. Designer-accepted deviation (2026-10-31): page numbers are hidden when the gap cannot hold 8 px + 11 px label — whenever the gap in screen px (at rest, or the layout gap times the live gesture scale) is shorter than 19 px — and shown otherwise; a number is either exactly 8 px / 11 px at full opacity or not rendered (no fade, transition or position jump). The page shadow SHALL be the kit `--page-shadow` in screen px at every zoom and live gesture, painted outside the zoom-scaled world so it never scales or jumps, tracking each page edge within 1 px, and never clipped into a hard band. The zoom-out floor SHALL be the lower of 0.25 × Fit and the whole-stack fit, but spreads MUST NOT get shorter than 16 px; a book too long to fit at 16 px scrolls. At that 16 px floor every spread MUST be mounted (whole-book overview). In a book of two spreads or more, page 1 and a single last page SHALL each occupy a spread-wide slot with the page on its own half (page 1 right, last page left) and nothing painted on the other half (no paper, background, border or shadow; Owner Must, round 8, M55), on the canvas and in the spread list (kit `#/demo`); the spread list labels them `1` and the last page number, and middle spreads `a–b`. A single page SHALL have its number centred under it; a two-page spread centres each number under its page. While a filmstrip photo is dragged, each gap SHALL show the "Drop here for a new spread" pill on one line at a constant screen size (32 px tall, 12 px text, 8 px radius at every zoom), centred vertically between the bottom of the page-number line (19 screen px under the page) and the next spread's top (Owner design change, round 8, M56), never intersecting a page number; it SHALL be hidden (not faded) whenever the gap in screen px is shorter than the pill plus 19 px label clearance above and below (70 px). Window spacers, reveal, the zoom-out floor and zoom anchoring MUST use the same stride.

#### Scenario: Gap scales with zoom

- **WHEN** the user zooms in or out and the zoom commits, down to the smallest reachable zoom
- **THEN** the gap divided by the spread height is unchanged (within 2%) and the spread under the pointer keeps its screen position

#### Scenario: Long book at the floor

- **WHEN** a 40-spread book is zoomed out to the floor
- **THEN** the gap keeps the same ratio to the spread height, the stack fits or scrolls, and every spread is mounted

#### Scenario: Shadow and page numbers hold screen px while zooming

- **WHEN** the user zooms to 18 %, Fit or 138 %, or is mid zoom gesture
- **THEN** the page shadow is the kit `--page-shadow` in screen px and every shown number is 8 px under its page, 11 px, centred under it

#### Scenario: Shadow tracks the page through a continuous zoom

- **WHEN** the user Ctrl+wheel zooms several steps in and back out
- **THEN** after every step each shadow box matches its page rect within 1 px and its computed shadow is unchanged

#### Scenario: Page numbers at the zoom floor

- **WHEN** the stack is at the zoom floor (gap about 16 px), or a wheel zoom passes through gaps under 19 px
- **THEN** no page number is shown there, and every number shown at any step is 8 px under its page at 11 px and opacity 1

#### Scenario: Single pages on their side

- **WHEN** a 19 × 23 book is open at Fit (1440 × 900)
- **THEN** page 1 is the right half of its 848 px slot and the last page the left half, each 424 × 513.25, and their list cards show the page on the same half of the spread-wide card with no background, border or shadow painted in the empty half

#### Scenario: New-spread pill in the gap

- **WHEN** a filmstrip photo is dragged at Fit, at 300 % and at a low zoom that still holds the pill
- **THEN** the pill has the same one-line rect size at each zoom, the space above it (page-number line bottom to pill top) equals the space below it (pill bottom to next spread top) within 0.5 px, and it intersects no page number; below the 70 px gap it is not shown

### Requirement: Camera zoom controls

Keyboard-reachable fit spread, fit width, and 100% physical size (96 CSS px/inch) plus a percent indicator. Fit spread SHALL size the book's widest spread (two pages; kit `viewport.tsx` `SW`) into the port, so every spread of the book, single pages included, fits at the same Fit zoom and the indicator reads "Fit" on each. Changing the active spread MUST keep the committed zoom; after a manual zoom the indicator shows the percent, not "Fit". Controls MUST NOT create page-level H/V scroll.

#### Scenario: Fit and 100%

- **WHEN** the user chooses 100%, fit width, or fit spread
- **THEN** sizing matches physical size / port width / port fit respectively and the document has no page scroll

#### Scenario: Fit follows the active spread

- **WHEN** at Fit the user selects page 1, then spread 2–3, then the last page in the spreads list
- **THEN** each active spread lies inside the pasteboard and the indicator reads "Fit"

#### Scenario: Fit after the book's trim changes

- **WHEN** the camera is at Fit and the open book's trim changes (a 19 × 23 cm book opens in a mounted editor)
- **THEN** the camera refits for the new trim, so an explicit Fit spread leaves the zoom unchanged

#### Scenario: Tied spreads keep the active mark

- **WHEN** at Fit several spreads are whole on screen and the pasteboard resizes
- **THEN** the active spread stays active while its visible ratio is within 0.02 of the most visible spread

### Requirement: Place and replace from the gallery

Place or replace a frame photo by dragging from the filmstrip onto a frame (empty → place, filled → replace). One document operation per drop. Photo remains in the filmstrip with Placed badge updates. There MUST NOT be a Replace button, photo-picker modal, or click-to-place/replace from gallery selection on the frame control. Empty gallery: no Placed/Unplace; empty frames stay “Place photo” placeholders (move/swap labels only when a move source is armed). Place/replace MUST NOT create page-level H/V scroll (H in filmstrip, V in pasteboard).

#### Scenario: Place, replace, empty gallery

- **WHEN** a photo is placed or replaced via filmstrip drag, or a frame is activated with an empty gallery / no move source
- **THEN** frames and Placed badges match the requirement, no Replace control is present, and the document stays contained

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

### Requirement: Smaller template announces unplaced photos

When a template change removes placements, the polite live region MUST read `1 photo was unplaced from the spread` or `N photos were unplaced from the spread`. Removed photos stay in the gallery. No removals MUST leave the live region unchanged. Empty gallery template change: no Placed badge; live region stays empty. Smaller template MUST NOT create page scroll.

#### Scenario: Overflow placements announced

- **WHEN** a filled spread switches to a template with fewer slots
- **THEN** overflow photos leave the spread but stay in the gallery, badges update, and the live region reports the removal count

### Requirement: Multi-photo drop fills frames or creates a spread

Dropping several photos on a spread frame SHALL place them in gallery order into the target frame (replacing it if filled) and the remaining empty frames, as one history step; photos beyond free frames SHALL stay unplaced and the status SHALL report how many. Dropping them in the gap between spreads (or after the last) SHALL insert one new spread using the best-fit template with the photos placed in order, as one history step.

#### Scenario: Four photos on a 4-grid

- **WHEN** four photos are dropped on an empty 4-grid spread
- **THEN** all four frames fill in gallery order

#### Scenario: Two portraits between spreads

- **WHEN** two portraits are dropped between two spreads
- **THEN** a new two-portrait spread appears there; Undo removes it

#### Scenario: More photos than frames

- **WHEN** five photos are dropped on a 4-grid
- **THEN** one stays unplaced and the status reports 1 left

#### Scenario: Filled target

- **WHEN** photos are dropped on a filled frame
- **THEN** it is replaced and the rest go to empty frames

### Requirement: Header tool group and tool cursors

The editor header toolbar SHALL hold a single-select tool group (Select · Frame · Text · Hand, hotkeys V / F / T / H; never empty, Select by default), not a floating rail. The group is a `bg-muted` rounded pill; each tool is a 32 px muted toggle whose selected state is a raised light pill (`bg-background` + `shadow-sm`), never an ink/black fill or blue. View toggles keep their own `bg-accent` selected look. The toolbar (tools + Snap + Grid) SHALL be centred on the canvas area between the left panel width and the inspector width (1440 px wide with 212 / 300 px panels: centre 676), following panel resizes but not panel open state, and MUST NOT overlap the history or zoom groups. Hotkeys SHALL be ignored with modifiers, while typing, and while Space is held. The canvas cursor SHALL follow the tool: Frame/Text white mark with a thin black outline, Hand `grab`, Select the default arrow; Space-pan keeps its grab cursor and no-outline behavior. Crop stays in the inspector (no floating frame toolbar).

#### Scenario: Tool switches by click and hotkey

- **WHEN** the user clicks Text or presses F
- **THEN** that tool shows the raised selected pill, the others are muted, and the canvas cursor class matches the tool

#### Scenario: Space pan overrides the tool cursor

- **WHEN** Space is held with the Frame tool active
- **THEN** the canvas shows the pan grab cursor with no focus outline, and the tool cursor returns on release

#### Scenario: Tool group over the canvas area

- **WHEN** the editor is 1440 px wide with both panels open, then the inspector closes, then the left panel widens
- **THEN** the group centre is (left panel right + inspector left) / 2 within 1 px, stays put when the inspector closes, and follows the wider left panel

### Requirement: Frame tool draws, moves and snaps free frames

With the Frame tool, dragging on bare spread paper SHALL draw an empty image frame, committed only when both edges are at least 5 mm; the new frame is selected and the tool returns to Select. With the Select tool, dragging an empty frame SHALL move it. Delete / Backspace SHALL remove the selected empty frame. Each edit clears the spread's template binding and is one undo step. While drawing or moving, edges and centers SHALL snap (8 px pull) to other frames, guides and equal gaps through an anchor index, showing a grey snap line with a `snap · <kind>` label; Alt suppresses snapping. There is no toast on create.

#### Scenario: Draw, then delete

- **WHEN** the user presses F, drags at least 5 mm on bare paper and presses Delete
- **THEN** a selected empty frame appears with the Select tool active, and Delete removes it

#### Scenario: Too small

- **WHEN** the drag is under 5 mm on either edge
- **THEN** no frame is created

#### Scenario: Alt skips snap

- **WHEN** a draw corner is within the pull distance of a frame edge and Alt is held
- **THEN** no snap line shows and the corner is not moved

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

### Requirement: Shift+click multi-frame selection

The frame selection SHALL be a set of frames on one spread. Shift+click (or Shift+Enter / Shift+Space on a focused frame) on frame F SHALL toggle F when the selection is on F's spread, else select F alone; it SHALL NOT swap, move, place or enter crop. One frame left SHALL be the single selection (handles, Photo inspector). With 2 or more selected: every selected frame keeps its outline, no frame shows handles, a 1 px dashed `--color-mark` group box SHALL surround the axis-aligned union of the selected frames (rotated corners included) 4 screen px out, with no fill and no pointer events, hidden in crop mode and Preview; selected frames SHALL NOT start a photo drag; the inspector SHALL show the Multiple selection context; a plain click or double-click on a frame SHALL select it alone first (no swap); Esc SHALL clear the selection; Delete / Backspace SHALL delete every selected frame, locked ones included (as the Delete frame button), in one undo step labelled "Delete N frames", instead of unplacing the focused frame.

#### Scenario: Shift+click two filled frames

- **WHEN** the user clicks a filled frame and Shift+clicks a second filled frame on the same spread
- **THEN** both frames are pressed, no handles show, the group box is their union plus 4 px on each side and both photos stay in place

#### Scenario: Delete a set with a locked frame

- **WHEN** three frames are selected, one of them locked, and the user presses Delete
- **THEN** all three frames are removed and one Undo restores them

### Requirement: Group move of a multi-frame selection

With 2 or more frames selected, a press on the body of any selected frame (filled or empty) with the Select tool SHALL start a pointer move, not a photo drag. Every unlocked selected frame SHALL move by the same delta and locked ones SHALL stay; with all locked nothing moves and the status shows the frame-locked message. The union of the moving frames SHALL snap against anchors that exclude the selection (Alt or snap off skips it; Shift locks the dominant axis) and stay inside the spread. The preview SHALL be direct DOM writes (one translate per moving frame and the group box in the same frame) with no book commit until release, which SHALL commit one `moveFrames` op as one undo step labelled "Move N frames". Esc during the move SHALL put every frame back and keep the selection. Arrows / Shift+arrows with 2 or more selected SHALL nudge every unlocked selected frame by 1 / 10 mm (one undo step per press) without scrolling the pasteboard.

#### Scenario: Group move with a locked frame

- **WHEN** three frames are selected, one locked, and the user drags one of them by 20 mm
- **THEN** the two unlocked frames move by the same delta, the locked one stays, and one Undo restores both

#### Scenario: Esc mid-move and arrows

- **WHEN** the user presses Esc during a group move, or ArrowRight with the set selected
- **THEN** Esc puts every frame back with the set still selected; ArrowRight nudges the unlocked frames 1 mm and the pasteboard does not scroll

### Requirement: Marquee selection

With the Select tool, a press on the pasteboard (gaps included, scrollbars excluded) or on paper not covered by a frame SHALL start a marquee once the pointer travels 3 px; below that it SHALL stay the pasteboard click. The marquee SHALL target the spread under the press (on the pasteboard, the editable spread whose paper is nearest to the press; on a tie, the one whose slot holds it), which SHALL become active once the marquee starts, and hit every own frame of that spread, locked included, whose painted axis-aligned box (rotation included) it touches; parent and other-spread frames SHALL NOT be hit. Hit frames SHALL show the selected outline live, from a hit index built at press (no per-move DOM scan). Release SHALL select the hits, unioned with the previous selection on that spread when Shift was held at the press; Esc SHALL cancel it and restore the previous selection. The Hand tool and Space-pan SHALL pan instead. The box SHALL be screen px: `--select` 10% fill, 1 px solid `--color-mark` outline, square corners, above the group box, clipped to the scrollport.

#### Scenario: Marquee from the pasteboard

- **WHEN** the user drags from the pasteboard beside a spread across two of its frames, then Shift-drags over a third, then starts another drag and presses Esc
- **THEN** the first drag selects 2 frames, the Shift drag 3, and after Esc the 3 stay selected

### Requirement: Multi-selection inspector

With 2 or more frames selected on a book spread the inspector SHALL show the kit Multiple selection context: `layers` icon, title "Multiple selection", meta `N frames · ` plus the non-zero parts of `K photo(s)`, `E empty`, `T text`; then expanded Align & distribute, expanded Arrange and "Delete N frames", and no single-frame section. Align & distribute SHALL be three groups (left / horizontal centers / right, top / vertical centers / bottom, distribute horizontally / vertically) of 28×28 buttons that wrap; Align needs 2 and Distribute 3 unlocked frames, else the button stays focusable with `aria-disabled` and the reason ("Needs 2 unlocked frames" / "Select 3 or more unlocked frames") as its tooltip. Align and Distribute SHALL move only unlocked frames, against the bounds of the unlocked frames, in one undo step. The caption SHALL read `Selection W × H mm` (all selected) plus ` · L locked, skipped` only when L > 0. Arrange SHALL label `layers a–b of M`; front / back move the selected block keeping its order; forward / backward move each selected frame past the next unselected one.

#### Scenario: Distribute three frames

- **WHEN** three unlocked frames are selected and the user clicks Distribute horizontally
- **THEN** the gaps between them are equal and one Undo restores all three

#### Scenario: Align skips a locked frame

- **WHEN** three frames are selected, one locked, and the user clicks Align left edges
- **THEN** the two unlocked frames share a left edge, the locked frame stays put and the caption ends "· 1 locked, skipped"

## MODIFIED Requirements

### Requirement: Stack spacing and page labels

The gap between consecutive spreads on the pasteboard (bottom edge to next top edge) SHALL be a fixed fraction of the spread height, 72 / 588 (wider than the kit `#/demo` 44 / 588 by design), at every committed zoom including the smallest reachable zoom, so the gap looks the same relative to the pages. Each page number SHALL sit a constant 8 screen px under its own page's bottom edge with an 11 px font that does not scale with zoom, including during a live zoom gesture. Designer-accepted deviation (2026-10-31): page numbers are hidden when the gap cannot hold 8 px + 11 px label — whenever the gap in screen px (at rest, or the layout gap times the live gesture scale) is shorter than 19 px — and shown otherwise; a number is either exactly 8 px / 11 px at full opacity or not rendered (no fade, transition or position jump). The page shadow SHALL be the kit `--page-shadow` in screen px at every zoom and live gesture, painted outside the zoom-scaled world so it never scales or jumps, tracking each page edge within 1 px, and never clipped into a hard band. The zoom-out floor SHALL be the lower of 0.25 × Fit and the whole-stack fit, but spreads MUST NOT get shorter than 16 px; a book too long to fit at 16 px scrolls. At that 16 px floor every spread MUST be mounted (whole-book overview). A single page (page 1, a single last page) SHALL have its number centred under it; a two-page spread centres each number under its page. Window spacers, reveal, the zoom-out floor and zoom anchoring MUST use the same stride.

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

### Requirement: Swap, move, and unplace

Drop filled→filled swaps (including across spreads); filled→empty moves; drop on self is a no-op; drop on filmstrip unplaces. One operation per accepted drop; photos stay in the filmstrip; Placed clears when no placements remain. Dragging a filled frame's body, selected or not, SHALL be this photo drag, never a frame move (kit `#/demo` step 17); only empty frames move by their body. While a photo frame is dragged (over the canvas, other frames or the filmstrip) the editor status SHALL paint as the kit status pill "Drag onto another frame to swap, or onto the filmstrip to take the photo back" at the canvas bottom-left (12 px insets, 12 px text, 8 px radius) until the drag ends; other editor statuses stay a live region with no visible chip. Keyboard (no gallery click-place): mark move source, swap/move by activating another frame, or Unplace. Escape clears move source and gallery selection. Delete/Backspace unplaces focused filled frame (ignored in text fields). Unplace keeps focus on emptied frame and announces; live region follows select/swap/move. Move source MUST clear when its frame is missing/empty; Unplace control stays in filmstrip but unavailable without a source. Frame drag unplace/swap only for same-document matching payload. Pressed move source shows a visible outline (including when zoomed out). Swap/move/unplace MUST NOT create page-level H/V scroll.

#### Scenario: Pointer and keyboard rearrange

- **WHEN** the user swaps, moves, or unplaces via pointer or keyboard (including Escape, Delete, cancel source)
- **THEN** placements, badges, focus, announcements, and containment match the requirement

#### Scenario: Drag hint while a selected photo frame is dragged

- **WHEN** the user drops a photo on a frame, clicks it, and drags it over another frame and then the filmstrip
- **THEN** the frame does not move, the hint pill shows bottom-left throughout, and after release on the filmstrip the photo is unplaced and the pill is gone

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

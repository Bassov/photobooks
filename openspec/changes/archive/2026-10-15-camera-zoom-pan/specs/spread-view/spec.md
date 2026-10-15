# Spec Delta

## ADDED Requirements

### Requirement: Pointer and keyboard zoom

Ctrl or Cmd plus wheel, and a pinch, SHALL zoom the pasteboard around the pointer. The `+` and `-` keys SHALL zoom around the viewport center. Zoom MUST NOT go below the level that fits the whole spread stack in the pasteboard port, and MUST be able to reach at least 400% of physical size. Opening the app MUST keep the current layout scale.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user Ctrl- or Cmd-wheels over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays in place

#### Scenario: Plus zooms about the center

- **WHEN** the user presses `+` while the pasteboard is in use
- **THEN** the stack grows about the viewport center and the zoom indicator updates

#### Scenario: Zoom out stops at the whole book

- **WHEN** the user zooms out until the stack fits in the pasteboard port
- **THEN** further zoom-out does not shrink the stack below that fit

### Requirement: Space pan

Holding Space and dragging over the pasteboard SHALL pan the pasteboard scrollport.

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

### Requirement: Whole-book zoom mounts the visible stack

When the painter fixture is zoomed so the full stack fits in the pasteboard port, the mounted window MUST include every spread in that stack.

#### Scenario: Fit-all mounts the fixture

- **WHEN** the painter fixture is zoomed so the whole book fits in the pasteboard port
- **THEN** every spread in the stack is mounted

## MODIFIED Requirements

### Requirement: Pasteboard scrollport

The pasteboard SHALL be the scrollport for the spread stack: vertical always, and horizontal when the stack is wider than the port. The document MUST NOT gain page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the pasteboard

- **WHEN** the fixture stack is taller than the workspace
- **THEN** the pasteboard scrolls vertically and the document element does not scroll

#### Scenario: Wide zoom scrolls inside the pasteboard

- **WHEN** zoom makes a spread wider than the pasteboard port
- **THEN** horizontal scrolling happens only inside the pasteboard and the document element does not scroll

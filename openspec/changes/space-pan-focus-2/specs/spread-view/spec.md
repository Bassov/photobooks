## MODIFIED Requirements

### Requirement: Pointer, keyboard zoom, and space pan

Ctrl/Cmd + wheel and pinch SHALL zoom around the pointer; `+`/`-` SHALL zoom
around the viewport center. Zoom MUST NOT go below whole-stack fit and MUST reach
at least 400% of physical size. Opening the app MUST keep the current layout scale.
Holding Space and dragging on the pasteboard SHALL pan the pasteboard scrollport
whenever the pointer is over the pasteboard and focus is not in a text input
(including when focus remains on a filmstrip tile, toolbar control, or
Space-activated radio/checkbox). When the pointer is not over the pasteboard,
Space MUST NOT arm pan so keyboard activation of focused controls still works.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user Ctrl- or Cmd-wheels over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays

#### Scenario: Plus zooms about the center; zoom-out stops at fit

- **WHEN** the user presses `+`, or zooms out until the stack fits the port
- **THEN** the stack grows about the viewport center (and the zoom indicator updates),
  or further zoom-out does not shrink below whole-book fit

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space drag pans after filmstrip or chrome focus

- **WHEN** focus is on a filmstrip tile or other non-text chrome control, the pointer
  is over the pasteboard, and the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space activates chrome when pointer is off the pasteboard

- **WHEN** focus is on a filmstrip tile or Space-activated control and the pointer
  is not over the pasteboard and the user presses Space
- **THEN** pan does not arm and the focused control may activate

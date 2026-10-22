## MODIFIED Requirements

### Requirement: Pointer, keyboard zoom, and space pan

Ctrl/Cmd + wheel and pinch SHALL zoom around the pointer; `+`/`-` SHALL zoom
around the viewport center. Zoom MUST NOT go below whole-stack fit and MUST reach
at least 400% of physical size. Opening the app MUST keep the current layout scale.
Holding Space and dragging on the pasteboard SHALL pan the pasteboard scrollport
whenever focus is not in a text input (including when focus remains on editor
chrome such as the filmstrip or toolbar).

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space drag pans after chrome focus

- **WHEN** focus is on a filmstrip or toolbar control (not a text input) and the
  user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

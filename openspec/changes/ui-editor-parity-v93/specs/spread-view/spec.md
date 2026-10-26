## MODIFIED Requirements

### Requirement: Pointer, keyboard zoom, and space pan

Wheel (with or without Ctrl/Cmd) and pinch SHALL zoom around the pointer; `+`/`-` SHALL zoom around the viewport center. Zoom MUST NOT go below whole-stack fit and MUST reach at least 400% of physical size. Opening the app MUST keep the current layout scale. Holding Space and dragging on the pasteboard SHALL pan the pasteboard scrollport whenever the pointer is over the pasteboard and focus is not in a text input (including when focus remains on a filmstrip tile, toolbar control, or Space-activated radio/checkbox). While Space is held (pan armed), editor panel hotkeys MUST NOT toggle panels. Pressing Space without starting a pasteboard drag MUST still activate a focused filmstrip tile or other Space-activated chrome control (even when the pointer is over the pasteboard or filmstrip). When the pointer is not over the pasteboard, Space MUST NOT arm pan so keyboard activation of focused controls still works. Text inputs remain exempt from Space-pan. While pan is armed, the canvas MUST expose `data-panning` and MUST NOT show a focus ring on the canvas viewport.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user wheels (or Ctrl-/Cmd-wheels) over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays

#### Scenario: Plus zooms about the center; zoom-out stops at fit

- **WHEN** the user presses `+`, or zooms out until the stack fits the port
- **THEN** the stack grows about the viewport center (and the zoom indicator updates), or further zoom-out does not shrink below whole-book fit

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space drag pans after filmstrip or chrome focus

- **WHEN** focus is on a filmstrip tile or other non-text chrome control, the pointer is over the pasteboard, and the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag and that Space does not toggle the focused control

#### Scenario: Space activates filmstrip tile when pointer is over pasteboard

- **WHEN** focus is on a filmstrip tile, the pointer is over the pasteboard or filmstrip, and the user presses Space without dragging on the pasteboard
- **THEN** the focused tile activates or toggles selection and pan does not move the stack

#### Scenario: Space activates chrome when pointer is off the pasteboard

- **WHEN** focus is on a filmstrip tile or Space-activated control and the pointer is not over the pasteboard and the user presses Space
- **THEN** that control activates and pan is not armed

#### Scenario: Space held blocks panel hotkeys

- **WHEN** the user holds Space and presses a panel hotkey (`[`, `\`, `]`, `i`, or hide-all chord)
- **THEN** panel visibility does not change

### Requirement: Selection labels stay the same

Frame controls MUST NOT expose a “Replace photo” label or Replace button. Labels for move/swap remain: “Cancel move” on the move-source frame; “Swap photos” / “Move photo here” on other frames while a move source exists; empty frames without a move source stay “Place photo” placeholders. Gallery selection MUST NOT change frame control labels into place/replace click targets — place/replace is filmstrip drag only.

#### Scenario: No Replace control

- **WHEN** a gallery photo is selected and the user inspects a filled or empty frame control
- **THEN** no control named “Replace photo” is present

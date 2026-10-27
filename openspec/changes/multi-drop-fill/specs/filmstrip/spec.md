## ADDED Requirements

### Requirement: Multi-select photos

The filmstrip SHALL support Shift+click range, Ctrl/Cmd+click toggle, Ctrl/Cmd+A select-all and Esc clear; dragging a selected photo SHALL carry the whole selection in gallery order.

#### Scenario: Range select

- **WHEN** the user clicks photo 1 then Shift+clicks photo 4
- **THEN** photos 1–4 are selected

#### Scenario: Toggle and clear

- **WHEN** the user Ctrl+clicks a selected photo, then presses Esc
- **THEN** it is deselected, then all are cleared

#### Scenario: Drag carries selection

- **WHEN** a selected photo is dragged
- **THEN** all selected photos travel in gallery order

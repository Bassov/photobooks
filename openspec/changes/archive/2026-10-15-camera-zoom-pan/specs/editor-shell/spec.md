# Spec Delta

## ADDED Requirements

### Requirement: Camera zoom controls

The editor SHALL offer keyboard-reachable controls for fit spread, fit width, and 100% physical size, plus a zoom indicator of the current zoom as a percent of physical size (96 CSS pixels per inch). These controls MUST NOT create page-level horizontal or vertical scroll. 100% MUST size a millimetre at 96 CSS pixels per inch.

#### Scenario: 100% shows physical size

- **WHEN** the user chooses 100%
- **THEN** the indicator reads 100% and the active spread's on-screen millimetres match 96 CSS pixels per inch

#### Scenario: Fit width matches the port

- **WHEN** the user chooses fit width
- **THEN** the active spread's width matches the pasteboard port width and the indicator shows the resulting physical-size percent

#### Scenario: Fit spread fits in the port

- **WHEN** the user chooses fit spread
- **THEN** the active spread fits inside the pasteboard port

#### Scenario: Camera controls do not scroll the page

- **WHEN** the camera controls and the zoom indicator are visible
- **THEN** the document element does not gain horizontal or vertical page scroll

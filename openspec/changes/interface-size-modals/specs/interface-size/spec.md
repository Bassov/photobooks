## ADDED Requirements

### Requirement: Modal overlays at app scale

Modal dialogs, alert dialogs and the toast region SHALL render at the interface scale s: their overlay root carries `zoom: var(--ui-scale)`, so each one's rect equals R(s), the same state at 100 % in a W/s × H/s viewport with values × s (±0.5 px). They stay centred, or bottom-right for toasts, as at 100 % and inside the viewport. At 100 % nothing changes.

#### Scenario: Dialog at 150 %

- **WHEN** the window is 3840×2160 with choice `"150"` and the Create book, Print or a confirm dialog opens
- **THEN** its rect is the rect at 100 % in a 2560×1440 window × 1.5 (±0.5 px), centred in the window

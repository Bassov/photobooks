## MODIFIED Requirements

### Requirement: Spread pager

The renderer SHALL provide a shared pager showing one spread at a time, navigable by arrow keys, Space, click on either half and horizontal swipe, exiting on Esc; neighbouring spreads SHALL stay mounted for preload and transitions SHALL use only `transform` and `opacity`. While open it SHALL hold keyboard focus (Tab / Shift+Tab never leave it) and on exit SHALL return focus to the control that opened it.

#### Scenario: Next on the last spread

- **WHEN** the last spread is shown and the user navigates forward
- **THEN** the index does not change

#### Scenario: Click halves and Esc

- **WHEN** the user clicks the right (left) half, or presses Esc
- **THEN** the pager moves forward (back), or calls exit and focus returns to the opener

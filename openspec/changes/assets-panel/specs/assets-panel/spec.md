## ADDED Requirements

### Requirement: Assets panel

The editor left panel SHALL offer an Assets tab next to Pages listing every gallery photo with thumbnail, name, status (ok / missing / modified), use count and spread numbers (“unused” when none). Rows MUST be virtualized and scroll only inside the `assets-list` scrollport; sort by status or uses MUST run in a transition and MUST NOT mutate the book.

#### Scenario: Rows reflect usage and status

- **WHEN** a photo is placed twice and another file is missing
- **THEN** its row shows “2×” with spread numbers and the missing row shows a missing badge

### Requirement: Jump and Update

Clicking a used row SHALL scroll the pasteboard to the spread of its first frame and make that spread active. A modified row SHALL offer Update, which refreshes previews and MUST keep the frame crop. An unused row SHALL have no jump action. Update with no staged match MUST tell the user via the status line to rescan from the relink dialog.

#### Scenario: Update keeps crop

- **WHEN** the user presses Update on a modified placed photo
- **THEN** the row becomes ok and the frame crop is unchanged

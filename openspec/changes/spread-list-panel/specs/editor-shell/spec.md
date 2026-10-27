## ADDED Requirements

### Requirement: Spreads list panel

The left panel SHALL list every spread as an inert thumbnail (the spread painter at thumb size, filmstrip thumbs only, windowed by a fixed row stride); a thumbnail MUST re-render only when its own spread changes. Clicking a row, or ↑/↓ on the list, SHALL make that spread active and reveal it on the pasteboard even when its slot is not mounted. A per-row menu SHALL offer Add after, Duplicate and Delete; Ctrl/Cmd+Enter, Ctrl/Cmd+D and Delete/Backspace on a row act on that (focused) row's spread. Duplicate inserts a copy (same frames and template, new id) right after the source; Delete is disabled for the last spread, selects the next (else previous) spread and shows an Undo toast. Thumbnails MUST NOT carry the pasteboard's test ids or register image tiers. Scrolling stays inside `spreads-list` and the pasteboard; no page-level H/V scroll.

#### Scenario: Click navigates

- **WHEN** the user clicks a thumbnail of a far-away spread
- **THEN** that row is selected and the pasteboard scrolls to that spread

#### Scenario: Duplicate and delete

- **WHEN** the user duplicates a spread, then deletes it and presses Undo
- **THEN** the copy appears right after the source, disappears on Delete, and returns on Undo

#### Scenario: Last spread

- **WHEN** only one spread remains
- **THEN** Delete does nothing and the menu item is disabled

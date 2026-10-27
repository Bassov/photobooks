## MODIFIED Requirements

### Requirement: Editor shell layout

The system SHALL present an editor shell matching kit editor chrome when the editor surface is active: top bar, left spreads panel frame, center canvas workspace, bottom filmstrip dock, and right inspector frame. App surfaces SHALL be one of: unsupported-browser, welcome, library (empty or with books), or editor. When File System Access directory picking is unavailable (or the context is insecure / mobile-only), unsupported-browser MUST be the only surface. When a library handle is granted and no in-tab book is active, library MUST be primary. When no library handle is available (or permission is denied/missing), welcome MUST be primary. The legacy single photo-card success screen and the multi-recent home screen MUST NOT be primary. The shell SHALL fill the viewport without page-level H/V scroll (library, filmstrip, pasteboard, and spreads-list are the named scrollports for their surfaces). The center canvas MUST mount the working pasteboard (including ConnectedSpreadView); the dock MUST mount the working filmstrip. Folder import, filmstrip place, and checking-photos reload behavior MUST continue to work through the new chrome. The right inspector frame MAY be stub chrome in this change; crop stays on existing pasteboard/filmstrip paths (kit inspector crop is out of scope). Preview, Print, and Publish chrome MUST be look-only (disabled or quiet no-op; in-app Preview deferred) and MUST NOT call production site/print backends. A Library control in the top bar MUST leave the editor for the library surface via the existing leave-editor path. Panel collapse MAY follow kit toggles (show/hide); side-panel widths follow "Resizable side panels".

#### Scenario: Shell vs library

- **WHEN** the editor surface is active
- **THEN** kit chrome regions (top bar, canvas workspace, filmstrip dock) are visible and the legacy photo-card success screen is not primary

- **WHEN** the app opens with a granted library handle and no in-tab active book
- **THEN** library is the primary surface

#### Scenario: Working canvas and dock

- **WHEN** the user opens a library-backed book
- **THEN** the pasteboard and filmstrip are mounted inside the kit canvas and dock regions and folder import / place still work

#### Scenario: Quiet publish chrome

- **WHEN** the user activates Preview, Print, or Publish in the editor top bar
- **THEN** no production site/print backend is called

#### Scenario: Back to library from kit top bar

- **WHEN** the user activates Library in the editor top bar
- **THEN** the leave-editor path runs and the library surface is shown (or the editor stays with a message on flush failure)

## ADDED Requirements

### Requirement: Resizable side panels

The left spreads and right inspector panels SHALL be resizable from a `role=separator` splitter on their inner edge by primary-button pointer drag and by ArrowLeft/ArrowRight (8 px; Shift ×4), clamped to 150–360 px (defaults 212 / 300). Widths MUST persist per browser in `localStorage`; missing, invalid or unreadable values MUST fall back to the defaults. Enter on a splitter and the panel header collapse button MUST hide the panel through the existing open/hide state and move focus to that panel's top-bar toggle. No panel width MAY introduce page-level H/V scroll.

#### Scenario: Resize persists across reload

- **WHEN** the user drags or arrow-keys the left splitter past either bound and reloads
- **THEN** the panel stays clamped to 150–360 px at the last committed width

#### Scenario: Keyboard collapse keeps focus

- **WHEN** the user presses Enter on a focused splitter
- **THEN** the panel hides and focus lands on its top-bar toggle

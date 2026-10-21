## MODIFIED Requirements

### Requirement: Home screen, books list, and open

With no in-tab book to restore, home SHALL list recent libraries (preselect last active when still recent), offer create/open, show loading until restore settles, and show explicit error+retry on listing failure. Selecting a recent library lists books by display title; `permission-required` shows hint + re-grant (not silent empty). Home overflow scrolls only in a named home scrollport. One activation opens a listed book when granted; remember book + re-grant on permission-required; failed open leaves recent order unchanged and clears locked access phase on home. Home actions MUST serialize while busy. Home MUST expose one page `h1`, visible `:focus-visible` rings on list controls, and a polite live announcement when the selected recent library changes; while busy, focus MUST remain on the control that started the action. Headings MUST NOT carry redundant ARIA roles/labels.

#### Scenario: One click opens a book

- **WHEN** the user activates a listed book with a granted handle
- **THEN** the editor shows that book’s gallery and placements

#### Scenario: Selected library is announced

- **WHEN** the user selects a recent library on home
- **THEN** a polite live region announces that library’s label and focus stays on the selected control unless the user moves it

### Requirement: Leave editor and re-grant from home

Home control SHALL flush pending saves, release lock, clear in-tab id and session assets, and show home; flush/save-error keeps the editor with a message. After Home, another library MUST NOT receive the previous book file. Re-grant from home prefers `requestPermission`, then picker with `isSameEntry` check; success opens the pending book; mismatch/deny shows error without silent no-op. Permission deny and picker cancel MUST use distinct readable messages. When a target library id is known but peek fails, re-grant MUST refuse binding an arbitrary picked folder. Editor status for typed failures MUST use human-readable text (never raw codes such as `permission-required`).

#### Scenario: Home then other library does not leak

- **WHEN** the user leaves via Home then opens a different library
- **THEN** the editor shows that library’s book and storage has no copy of the previous book

#### Scenario: Peek-failed re-grant refuses bare bind

- **WHEN** re-grant has a target library id whose stored handle cannot be peeked and the user picks a folder
- **THEN** the app refuses the bind with a readable error and does not attach that folder as the target library

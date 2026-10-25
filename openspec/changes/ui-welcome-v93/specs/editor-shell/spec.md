## MODIFIED Requirements

### Requirement: Welcome screen

With no remembered library handle, or after permission denied/missing with no usable grant path, the system SHALL show a welcome screen matching kit first-run chrome (hero photo, Photobooks mark, primary **Create Library**). Activating Create Library MUST open the library directory picker described above and, on success, remember the handle and enter the library surface. Cancel MUST return to Welcome unchanged. The screen MUST show a plain CC BY-SA photo caption (no capsule) for the hero. Restore-pending, permission-required regrant, and homeError status MUST remain reachable on this surface.

#### Scenario: Choose folder from welcome

- **WHEN** the user activates Create Library and picks a directory
- **THEN** the handle is remembered and the library surface is shown

#### Scenario: Welcome chrome and credit

- **WHEN** Welcome is primary with no restore/regrant overlay
- **THEN** Create Library is the primary action and a plain `screen-credit` caption is visible without a capsule

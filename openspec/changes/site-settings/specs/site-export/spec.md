## ADDED Requirements

### Requirement: Settings → Site edits the site settings

Settings → Site SHALL edit Site title, Author (≤ 80) and Intro (≤ 160, one paragraph, live `n / 160` counter) in place: blur or Enter commits, Esc reverts to the stored value and keeps focus. An empty field SHALL show the site's fallback as its placeholder. The editor Preview and a session-only export SHALL use the current settings; typing SHALL re-render only the Settings section.

#### Scenario: Enter commits, Esc reverts

- **WHEN** the user types "Ann" in Author and presses Enter, then types "Bo" and presses Esc
- **THEN** the stored author is "Ann", the field shows "Ann" and keeps focus

#### Scenario: Empty fields show the fallbacks

- **WHEN** no site settings are set
- **THEN** the placeholders read "Photobooks", "Your name" and "A line or two about your books", and the counter `0 / 160`

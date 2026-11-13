## ADDED Requirements

### Requirement: Settings → Hosting form and connected card

Settings → Hosting SHALL show the five-field form with live validation (Connect only when valid), then a summary card with Check again, Replace token… and Forget token…. Opening Settings MUST send nothing. The secret MUST NOT enter React state, the DOM after Connect, logs, the URL or localStorage.

#### Scenario: Check failure in the footer

- **WHEN** Connect fails (e.g. CORS)
- **THEN** the footer shows the redacted message, the named fields ring red, a CORS failure marks help step 3, and nothing is stored

#### Scenario: Connect saves and hides the secret

- **WHEN** valid values are entered and R2 accepts the check write
- **THEN** the connected card shows, survives a reload, and the secret appears nowhere in the document, localStorage or URL

#### Scenario: Forget empties the form

- **WHEN** the user confirms Forget token
- **THEN** the stored credentials and status are deleted and the empty form shows with focus on Account ID

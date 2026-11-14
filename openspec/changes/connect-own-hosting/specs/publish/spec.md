## MODIFIED Requirements

### Requirement: Settings → Hosting form and connected card

Settings → Hosting SHALL open, when not connected, the guided setup card (three steps: connect the Cloudflare account with a setup token, choose the site address, set up; only the current step expanded, done steps collapsed to a summary with Change) with a link to the five-field manual form (live validation, Connect only when valid), then a summary card with Check again, Replace token… and Forget token…. Step 3 shows the six provisioning rows running / done / failed; Try again resumes at the failed row and Cancel setup returns to step 2. A setup-made card says "Set up automatically" until the first Check again, "New address" for 15 minutes, and asks to delete a left setup token. Opening Settings MUST send nothing. The secret and the setup token MUST NOT enter React state, the DOM after use, logs, the URL or localStorage.

#### Scenario: Check failure in the footer

- **WHEN** Connect fails (e.g. CORS)
- **THEN** the footer shows the redacted message, the named fields ring red, a CORS failure marks help step 3, and nothing is stored

#### Scenario: Connect saves and hides the secret

- **WHEN** valid values are entered and R2 accepts the check write
- **THEN** the connected card shows, survives a reload, and the secret appears nowhere in the document, localStorage or URL

#### Scenario: Guided setup resumes at the failed row

- **WHEN** row 3 fails on a DNS conflict and the user presses Try again
- **THEN** rows 1–2 stay done and send no request, setup goes on from row 3 and ends on the connected card

#### Scenario: Forget empties the form

- **WHEN** the user confirms Forget token
- **THEN** the stored credentials and status are deleted; a setup-made record shows the setup card with focus on the setup token, a manual one the empty form with focus on Account ID

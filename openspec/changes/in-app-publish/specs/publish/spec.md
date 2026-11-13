## ADDED Requirements

### Requirement: Publish from the editor

The editor top bar SHALL end with a "Publish" pill (after Export site) that keeps its label and its rest width in every state: idle "Publish", running `NN%` over a fill, a check for 4 s when done, a warning until opened when failed; its accessible name stays "Publish" and a status region announces progress at most every 10 %. Only one site job runs at a time: Publish is disabled while Export site runs and Export site while Publish runs. The pill opens a dialog: with no stored hosting it only offers "Open Settings → Hosting", which opens Settings on the Hosting section; otherwise Publish freezes the open book with `publishBook` and runs the publish worker. The running dialog can be hidden (Hide, Esc, outside click) and editing goes on. Done shows the book URL, a changed-files summary and "Open site" (the site home, `noopener`); failed shows the cause, "s of t files went up" when retryable, and "Try again" re-runs the same frozen revisions, or "Open Settings → Hosting" for `cors` / `key` / `denied` / `bucket`. A tab close during a run asks first.

#### Scenario: Republish sends only the change

- **WHEN** a published book has one spread changed and is published again
- **THEN** only keys whose hash changed are PUT, and no key outside the old manifest is deleted

#### Scenario: Try again after a failed upload

- **WHEN** one asset PUT answers 503 three times
- **THEN** the dialog shows "s of t files went up", and Try again PUTs only the keys not yet on R2
